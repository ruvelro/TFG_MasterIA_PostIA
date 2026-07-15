import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { DEFAULT_PIPELINE_PARAMS, DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import { resumeGeneration, reviseGeneration, startGeneration } from "@/lib/pipeline/orchestrator";
import {
  ArticleMetadataSchema,
  BlueprintSchema,
  EnrichStepOutputSchema,
  FactualReviewSchema,
  FactsSchema,
  FixerOutputSchema,
  QualityReviewSchema,
  ValidationReportSchema,
  type FactualReview,
} from "@/lib/pipeline/schemas";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";
import type { PipelineContext, PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

// Configuración resuelta de prueba (usa los prompts/modelos por defecto, que no se llaman
// de verdad porque las dependencias están mockeadas).
function makeConfig(maxFixIterations = 2): ResolvedPipelineConfig {
  return {
    steps: DEFAULT_STEP_CONFIG,
    editorialVoice: "Tono cercano",
    seoRules: "Usa la keyword en el primer párrafo",
    geoRules: "Responde preguntas frecuentes de forma directa",
    sourceCount: 2,
    // Desactivada en los tests del orquestador: la expansión tiene sus propios tests unitarios.
    queryExpansionModel: "",
    featureImageModel: "modelo/imagen",
    maxFixIterations,
    maxHumanizeRetries: DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries,
    aiScoreThreshold: DEFAULT_PIPELINE_PARAMS.aiScoreThreshold,
    scrubPatterns: [...DEFAULT_SCRUB_PATTERNS],
    forbiddenWords: [],
    validatorConfig: DEFAULT_VALIDATOR_CONFIG,
  };
}

// Dependencias falsas y deterministas. `runObject` decide la respuesta por IDENTIDAD del
// esquema (los steps pasan exactamente estos objetos de esquema), lo que evita acoplarse al
// orden de las llamadas.
function makeDeps(options: {
  validatePasses: boolean;
  validationPasses?: boolean[];
  validationAiToneSeverity?: "low" | "medium" | "high";
  aiScore?: number;
  aiScores?: number[];
  factualRisks?: FactualReview["riskLevel"][];
  factualSufficiencies?: boolean[];
  qualityAverages?: number[];
}): PipelineDeps {
  const {
    validatePasses,
    validationPasses = [validatePasses],
    validationAiToneSeverity = "low",
    aiScore = 20,
    aiScores = [aiScore],
    factualRisks = ["low"],
    factualSufficiencies = [true],
    qualityAverages = [85],
  } = options;
  let factualReviewIndex = 0;
  let qualityReviewIndex = 0;
  let validationIndex = 0;

  const runObject: PipelineDeps["runObject"] = async ({ schema }) => {
    const s = schema as unknown;
    let object: unknown;

    if (s === FactsSchema) {
      object = { facts: [{ claim: "Un hecho", source: "https://e.example/0" }] };
    } else if (s === BlueprintSchema) {
      object = {
        title: "Titular",
        angle: "Ángulo",
        readerPromise: "Promesa",
        mainThesis: "Tesis",
        leadAngle: "Lead",
        excludeOrCompress: ["Dato menor"],
        targetKeyword: "kw",
        sections: [{ heading: "H", summary: "S" }],
      };
    } else if (s === ValidationReportSchema) {
      const currentValidationPassed =
        validationPasses[Math.min(validationIndex, validationPasses.length - 1)] ?? validatePasses;
      validationIndex += 1;
      object = currentValidationPassed
        ? { passed: true, issues: [] }
        : {
            passed: false,
            issues: [
              {
                category: "ai-tone",
                severity: validationAiToneSeverity,
                description: "d",
                suggestion: "s",
              },
            ],
          };
    } else if (s === FactualReviewSchema) {
      const riskLevel =
        factualRisks[Math.min(factualReviewIndex, factualRisks.length - 1)] ?? "low";
      const sufficient =
        factualSufficiencies[Math.min(factualReviewIndex, factualSufficiencies.length - 1)] ?? true;
      factualReviewIndex += 1;
      object = {
        riskLevel,
        claims: [
          {
            claim: "Un hecho",
            status: riskLevel === "low" ? "confirmed" : "doubtful",
            reason: "Resultado factual de prueba",
          },
        ],
        summary: "Sin riesgos.",
        researchSufficiency: { sufficient, reason: "Evaluación documental de prueba." },
      };
    } else if (s === QualityReviewSchema) {
      const qualityAverage =
        qualityAverages[Math.min(qualityReviewIndex, qualityAverages.length - 1)] ?? 85;
      const currentAiScore = aiScores[Math.min(qualityReviewIndex, aiScores.length - 1)] ?? aiScore;
      qualityReviewIndex += 1;
      object = {
        structureScore: qualityAverage,
        factualSupportScore: qualityAverage,
        seoScore: qualityAverage,
        wordCount: 300,
        aiScore: currentAiScore,
        issues: [],
        suggestions: [],
      };
    } else if (s === FixerOutputSchema) {
      object = {
        contentMarkdown: "# Final\n**clave**",
        title: "Final",
        slug: "final",
        metaDescription: "meta",
        keywords: ["kw"],
      };
    } else if (s === ArticleMetadataSchema) {
      object = {
        title: "Final",
        slug: "final",
        metaDescription: "meta",
        keywords: ["kw"],
      };
    } else if (s === EnrichStepOutputSchema) {
      object = {
        headlineVariants: ["Titular alternativo"],
        tags: ["test", "e2e"],
        faq: [],
        imageAlt: ["Alt de prueba"],
        featuredImagePrompt: "An example test image prompt.",
      };
    } else {
      throw new Error("esquema inesperado en el test");
    }
    return { object: object as never, usage: { inputTokens: 1, outputTokens: 1 } };
  };

  return {
    search: async (_query, limit) =>
      Array.from({ length: limit }, (_unused, index) => ({
        title: `Fuente ${index}`,
        url: `https://e.example/${index}`,
        snippet: `extracto ${index}`,
      })),
    fetchContent: async (url) => `contenido descargado de ${url}`,
    runText: async () => ({
      text: "# Borrador\nTexto del borrador",
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
    runObject,
    runImage: async () => ({
      imageBase64: Buffer.from("png-falso").toString("base64"),
      mediaType: "image/png",
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
    // No toca disco: devuelve la ruta que persistiría el almacenamiento real.
    storeImage: async ({ runId }) => `uploads/featured/${runId}.png`,
    // Coste determinista para el test: 1e-6 USD por token, solo cuando hay modelo (etapas IA).
    estimateCost: async (model, inputTokens, outputTokens) =>
      model ? ((inputTokens ?? 0) + (outputTokens ?? 0)) * 1e-6 : null,
  };
}

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Test", email: `orch_${Date.now()}@postia.test` },
  });
  userId = user.id;
});

describe("orquestador del pipeline", () => {
  it("recorre todas las etapas y crea el artículo (sin pausa, validación pasa)", async () => {
    const result = await startGeneration({
      userId,
      topic: "Energía solar",
      pauseForReview: false,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");

    const steps = await prisma.generationStep.findMany({ where: { runId: result.runId } });
    const stageIds = steps.map((s) => s.stageId);
    expect(stageIds).toEqual(
      expect.arrayContaining([
        "research",
        "extract",
        "blueprint",
        "draft",
        "humanize",
        "validate",
        "factual-review",
        "quality-review",
        "fixer",
        "scrub",
        "enrich",
      ]),
    );

    // El enriquecimiento se computa (métricas derivadas) y se genera (campos creativos).
    expect(result.context.enrichment).toBeDefined();
    expect(result.context.enrichment?.headlineVariants.length).toBeGreaterThan(0);
    expect(result.context.enrichment?.aiDetection.label).toBe("humano");
    expect(result.context.enrichment?.qualitySummary.groundedness).toBe(100); // 1/1 confirmados
    // La validación pasó: el artículo se entrega como validado.
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(true);

    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article?.title).toBe("Final");
    expect(article?.contentMarkdown).toBe("# Borrador\nTexto del borrador");
    expect(JSON.parse(article?.keywords ?? "[]")).toEqual(["kw"]);

    // El coste estimado se persiste por etapa de IA (research no usa modelo → sin coste).
    const stepsWithCost = await prisma.generationStep.findMany({
      where: { runId: result.runId, costUsd: { not: null } },
    });
    expect(stepsWithCost.length).toBeGreaterThan(0);
    expect(stepsWithCost.every((s) => (s.costUsd ?? 0) > 0)).toBe(true);
    const researchStep = await prisma.generationStep.findFirst({
      where: { runId: result.runId, stageId: "research" },
    });
    expect(researchStep?.costUsd).toBeNull();

    // Invariante de atomicidad: el artículo existe Y el run quedó `completed` compartiendo runId.
    // Ambas escrituras ocurren en una única transacción (no puede haber artículo huérfano).
    const finishedRun = await prisma.generationRun.findUniqueOrThrow({
      where: { id: result.runId },
    });
    expect(finishedRun.status).toBe("completed");
    expect(article?.runId).toBe(finishedRun.id);
    // El enriquecimiento queda persistido en metadataJson para el historial.
    expect(article?.metadataJson).toBeTruthy();
    expect(JSON.parse(article?.metadataJson ?? "{}").tags).toEqual(["test", "e2e"]);
  });

  it("normaliza las fuentes en su tabla y las omite del contextJson", async () => {
    const started = await startGeneration({
      userId,
      topic: "Hidrógeno verde",
      pauseForReview: true,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    // Las fuentes (con su contenido descargado) están en GenerationSource, no en el snapshot.
    const sources = await prisma.generationSource.findMany({ where: { runId: started.runId } });
    expect(sources.length).toBe(2);
    expect(sources[0].content).toContain("contenido descargado");

    const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: started.runId } });
    const savedCtx = JSON.parse(run.contextJson ?? "{}") as PipelineContext;
    // El contextJson conserva los metadatos de las fuentes pero NO su contenido (peso).
    expect(savedCtx.sources.length).toBe(2);
    expect(savedCtx.sources.every((s) => s.content === "")).toBe(true);

    // Al reanudar, las fuentes se rehidratan con su contenido desde la tabla.
    const resumed = await resumeGeneration({
      runId: started.runId,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });
    expect(resumed.status).toBe("completed");
    expect(resumed.context.sources[0].content).toContain("contenido descargado");
  });

  it("se pausa tras la extracción y se reanuda con los hechos editados", async () => {
    const started = await startGeneration({
      userId,
      topic: "Coches eléctricos",
      pauseForReview: true,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(started.status).toBe("awaiting_review");
    expect(started.context.facts).toBeDefined();
    expect(await prisma.article.findFirst({ where: { runId: started.runId } })).toBeNull();

    const editedFacts = {
      facts: [{ claim: "Hecho editado por el usuario", source: "https://e.example/0" }],
    };
    const resumed = await resumeGeneration({
      runId: started.runId,
      editedFacts,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(resumed.status).toBe("completed");
    const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: started.runId } });
    const savedCtx = JSON.parse(run.contextJson ?? "{}") as PipelineContext;
    expect(savedCtx.facts?.facts[0].claim).toBe("Hecho editado por el usuario");
  });

  it("se pausa tras el blueprint y se reanuda con la estructura editada", async () => {
    const started = await startGeneration({
      userId,
      topic: "Inteligencia artificial",
      pauseForReview: false,
      pauseForBlueprintReview: true,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(started.status).toBe("awaiting_blueprint_review");
    expect(started.context.blueprint).toBeDefined();
    expect(await prisma.article.findFirst({ where: { runId: started.runId } })).toBeNull();

    const editedBlueprint = {
      title: "Titular editado",
      angle: "Ángulo editado",
      readerPromise: "Promesa editada",
      mainThesis: "Tesis editada",
      leadAngle: "Lead editado",
      excludeOrCompress: ["Dato editado menor"],
      targetKeyword: "ia",
      sections: [{ heading: "Intro editada", summary: "Resumen editado" }],
    };
    const resumed = await resumeGeneration({
      runId: started.runId,
      editedBlueprint,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(resumed.status).toBe("completed");
    const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: started.runId } });
    const savedCtx = JSON.parse(run.contextJson ?? "{}") as PipelineContext;
    expect(savedCtx.blueprint?.title).toBe("Titular editado");
  });

  it("con ambas revisiones activas pausa primero en hechos y LUEGO en la estructura", async () => {
    // Regresión: el flag pauseForBlueprintReview debe sobrevivir a la pausa de extracción. Antes
    // se perdía al reanudar y la revisión de estructura nunca se ofrecía.
    const started = await startGeneration({
      userId,
      topic: "Energía nuclear",
      pauseForReview: true,
      pauseForBlueprintReview: true,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });
    expect(started.status).toBe("awaiting_review");

    // Reanudar desde la pausa de hechos NO debe completar: debe pausar en la estructura.
    const afterFacts = await resumeGeneration({
      runId: started.runId,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });
    expect(afterFacts.status).toBe("awaiting_blueprint_review");
    expect(afterFacts.context.blueprint).toBeDefined();

    // Y reanudar desde la estructura sí completa.
    const completed = await resumeGeneration({
      runId: started.runId,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });
    expect(completed.status).toBe("completed");
  });

  it("itera el bucle validate↔fixer cuando la validación no pasa", async () => {
    const result = await startGeneration({
      userId,
      topic: "Cambio climático",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: false }),
    });

    expect(result.status).toBe("needs_review");
    const validateSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "validate" },
    });
    // Con maxFixIterations=2 y validación que nunca pasa: 2 validaciones del bucle, una
    // revisión IA completa del último fixer y la comprobación determinista post-scrub.
    expect(validateSteps.length).toBe(4);
    const attempts = validateSteps.map((s) => s.attempt).sort();
    expect(attempts).toEqual([1, 2, 3, 4]);

    // El juez IA sigue suspendiendo el texto tras agotar correcciones: la comprobación
    // determinista no debe convertir ese suspenso en aprobado.
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(false);
    const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).toBe("needs_review");
  });

  it("la revalidación final mantiene el suspenso si persisten problemas bloqueantes", async () => {
    // La validación IA nunca pasa Y el artículo final del fixer contiene una palabra
    // prohibida ("clave" aparece en su Markdown): la revalidación determinista posterior a
    // la última corrección debe suspender el artículo entregado.
    const result = await startGeneration({
      userId,
      topic: "Ciberseguridad",
      pauseForReview: false,
      cfg: { ...makeConfig(2), forbiddenWords: ["clave"] },
      deps: makeDeps({ validatePasses: false }),
    });

    expect(result.status).toBe("needs_review");
    const validateSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "validate" },
    });
    expect(validateSteps.length).toBe(4);
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(false);
    // El informe final describe el texto entregado, con el problema bloqueante visible.
    expect(result.context.report?.passed).toBe(false);
    expect(result.context.report?.issues.some((i) => i.severity === "high")).toBe(true);
  });

  it("respeta los toggles del tipo de noticia y omite las etapas desactivadas", async () => {
    const result = await startGeneration({
      userId,
      topic: "Drones de reparto",
      pauseForReview: false,
      newsType: {
        id: "minimo",
        label: "Mínimo",
        description: "Sin fases de calidad",
        enableHumanize: false,
        enableFactualReview: false,
        enableQualityReview: false,
        sourceStrict: true,
        structureInstruction: "Nota muy breve",
        targetWordCount: 200,
        voiceBrand: "",
        voiceHouseRules: "",
        voiceExamples: [],
        enableFeatureImage: false,
        freshnessDays: 0,
      },
      cfg: makeConfig(1),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");
    const stageIds = (await prisma.generationStep.findMany({ where: { runId: result.runId } })).map(
      (s) => s.stageId,
    );
    // Etapas opcionales desactivadas por el tipo: no deben haberse ejecutado.
    expect(stageIds).not.toContain("humanize");
    expect(stageIds).not.toContain("factual-review");
    expect(stageIds).not.toContain("quality-review");
    // Las etapas núcleo sí se ejecutan.
    expect(stageIds).toEqual(
      expect.arrayContaining(["research", "extract", "blueprint", "draft", "validate", "enrich"]),
    );
  });

  it("el validador determinista fuerza una corrección al detectar una palabra prohibida", async () => {
    // La validación IA pasa y aiScore es bajo (sin re-humanización): sin el validador, el bucle
    // terminaría a la primera. Pero "borrador" aparece en el draft falso y está prohibida →
    // el informe se marca como no superado y el corrector debe intervenir (2.ª validación).
    const result = await startGeneration({
      userId,
      topic: "Domótica",
      pauseForReview: false,
      cfg: { ...makeConfig(2), forbiddenWords: ["borrador"] },
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");
    const validateSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "validate" },
    });
    expect(validateSteps.length).toBe(3);
  });

  it("reserva la re-humanización final hasta después de las correcciones editoriales", async () => {
    const transformationOrder: string[] = [];
    const result = await startGeneration({
      userId,
      topic: "Robótica",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({
        validatePasses: false,
        validationPasses: [false, false, false, true],
        validationAiToneSeverity: "medium",
        aiScores: [24, 24, 24, 24],
        qualityAverages: [68, 68, 85, 85],
      }),
      onEvent(event) {
        if (
          event.status === "running" &&
          (event.stageId === "humanize" || event.stageId === "fixer")
        ) {
          transformationOrder.push(`${event.stageId}:${event.attempt}`);
        }
      },
    });

    expect(result.status).toBe("completed");
    const humanizeSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "humanize" },
    });
    // 1 humanize inicial + 1 pulido por el aviso ai-tone medio, aunque aiScore ya sea 24.
    expect(humanizeSteps.length).toBe(2);
    const fixerSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "fixer" },
    });
    expect(fixerSteps).toHaveLength(3); // dos correcciones + finalizador de metadatos
    expect(transformationOrder).toEqual([
      "humanize:1",
      "fixer:1",
      "fixer:2",
      "humanize:2",
      "fixer:3",
    ]);
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(true);
  });

  it("corrige un riesgo factual medio y solo aprueba después de volver a riesgo bajo", async () => {
    const result = await startGeneration({
      userId,
      topic: "Riesgo factual",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: true, factualRisks: ["medium", "low"] }),
    });

    const fixerSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "fixer" },
    });
    expect(fixerSteps).toHaveLength(2); // corrección factual + finalizador de metadatos
    expect(result.context.factualReport?.riskLevel).toBe("low");
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(true);
  });

  it("corrige un riesgo de calidad medio antes de aprobar el artículo", async () => {
    const result = await startGeneration({
      userId,
      topic: "Calidad editorial",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: true, qualityAverages: [68, 85] }),
    });

    const fixerSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "fixer" },
    });
    expect(fixerSteps).toHaveLength(2);
    expect(result.context.enrichment?.qualitySummary.qualityRisk).toBe("low");
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(true);
  });

  it("corrige cuando la revisión declara insuficientes las fuentes", async () => {
    const result = await startGeneration({
      userId,
      topic: "Suficiencia factual",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({
        validatePasses: true,
        factualSufficiencies: [false, true],
      }),
    });

    const fixerSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "fixer" },
    });
    expect(fixerSteps).toHaveLength(2);
    expect(result.context.factualReport?.researchSufficiency.sufficient).toBe(true);
    expect(result.context.enrichment?.qualitySummary.validationPassed).toBe(true);
  });

  it("genera y persiste la imagen destacada cuando el tipo la activa", async () => {
    const result = await startGeneration({
      userId,
      topic: "Con imagen destacada",
      pauseForReview: false,
      newsType: {
        id: "con-imagen",
        label: "Con imagen",
        description: "",
        enableHumanize: false,
        enableFactualReview: false,
        enableQualityReview: false,
        sourceStrict: false,
        structureInstruction: "",
        targetWordCount: 0,
        voiceBrand: "",
        voiceHouseRules: "",
        voiceExamples: [],
        enableFeatureImage: true,
        freshnessDays: 0,
      },
      cfg: makeConfig(1),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");
    const imageStep = await prisma.generationStep.findFirst({
      where: { runId: result.runId, stageId: "feature-image" },
    });
    expect(imageStep?.status).toBe("done");
    expect(imageStep?.model).toBe("modelo/imagen");

    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article?.featuredImagePath).toBe(`uploads/featured/${result.runId}.png`);
  });

  it("si el modelo de imagen falla, la generación se entrega sin imagen (degradación)", async () => {
    const deps = makeDeps({ validatePasses: true });
    deps.runImage = async () => {
      throw new Error("modelo de imagen caído");
    };
    const result = await startGeneration({
      userId,
      topic: "Imagen fallida",
      pauseForReview: false,
      newsType: {
        id: "con-imagen",
        label: "Con imagen",
        description: "",
        enableHumanize: false,
        enableFactualReview: false,
        enableQualityReview: false,
        sourceStrict: false,
        structureInstruction: "",
        targetWordCount: 0,
        voiceBrand: "",
        voiceHouseRules: "",
        voiceExamples: [],
        enableFeatureImage: true,
        freshnessDays: 0,
      },
      cfg: makeConfig(1),
      deps,
    });

    expect(result.status).toBe("completed");
    const imageStep = await prisma.generationStep.findFirst({
      where: { runId: result.runId, stageId: "feature-image" },
    });
    expect(imageStep?.status).toBe("error");
    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article).not.toBeNull();
    expect(article?.featuredImagePath).toBeNull();
  });

  it("marca el run como cancelled (no failed) cuando el usuario aborta", async () => {
    // El abort del stream se propaga a las llamadas de IA como AbortError: no es un fallo
    // del pipeline y no debe contaminar las métricas de fiabilidad.
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const deps = makeDeps({ validatePasses: true });
    deps.runObject = async () => {
      throw abortError;
    };

    await expect(
      startGeneration({
        userId,
        topic: "Generación cancelada",
        pauseForReview: false,
        cfg: makeConfig(),
        deps,
      }),
    ).rejects.toThrow("aborted");

    const run = await prisma.generationRun.findFirstOrThrow({
      where: { userId, topic: "Generación cancelada" },
    });
    expect(run.status).toBe("cancelled");
  });

  it("marca el run como failed ante un error real (no cancelación)", async () => {
    const deps = makeDeps({ validatePasses: true });
    deps.runObject = async () => {
      throw new Error("El modelo devolvió un error 500");
    };

    await expect(
      startGeneration({
        userId,
        topic: "Generación fallida",
        pauseForReview: false,
        cfg: makeConfig(),
        deps,
      }),
    ).rejects.toThrow("500");

    const run = await prisma.generationRun.findFirstOrThrow({
      where: { userId, topic: "Generación fallida" },
    });
    expect(run.status).toBe("failed");
  });

  it("reviseGeneration regenera desde un borrador existente sin investigar", async () => {
    // Artículo original al que la revisión debe quedar enlazada (versionado padre→hijo).
    const original = await prisma.article.create({
      data: {
        userId,
        title: "Original",
        slug: "original",
        contentMarkdown: "# Artículo original",
        metaDescription: "meta",
      },
      select: { id: true },
    });

    const result = await reviseGeneration({
      userId,
      topic: "Tema original",
      sourceArticleId: original.id,
      sourceContext: {
        topic: "Tema original",
        sources: [],
        facts: { facts: [{ claim: "Hecho previo", source: "https://e.example/0" }] },
        blueprint: {
          title: "T",
          angle: "A",
          readerPromise: "P",
          mainThesis: "Tesis",
          leadAngle: "Lead",
          excludeOrCompress: [],
          targetKeyword: "kw",
          sections: [],
        },
      },
      sourceArticleMarkdown: "# Artículo original\nContenido a revisar.",
      instructions: "Acorta la introducción.",
      cfg: makeConfig(1),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");
    // El contexto reutilizado lleva las instrucciones de revisión.
    expect(result.context.revisionInstructions).toBe("Acorta la introducción.");

    const stageIds = (await prisma.generationStep.findMany({ where: { runId: result.runId } })).map(
      (s) => s.stageId,
    );
    // NO se vuelve a investigar ni a diseñar la estructura: solo el bucle de calidad y el cierre.
    expect(stageIds).not.toContain("research");
    expect(stageIds).not.toContain("extract");
    expect(stageIds).not.toContain("blueprint");
    expect(stageIds).toEqual(expect.arrayContaining(["validate", "fixer", "scrub", "enrich"]));

    // Produce un artículo nuevo en un run nuevo, enlazado al original (versionado).
    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article).not.toBeNull();
    expect(article?.parentId).toBe(original.id);
  });

  it("inyecta el idioma solicitado en el prompt de redacción", async () => {
    const deps = makeDeps({ validatePasses: true });
    const prompts: string[] = [];
    const originalRunText = deps.runText;
    deps.runText = async (params) => {
      prompts.push(params.prompt);
      return originalRunText(params);
    };

    const result = await startGeneration({
      userId,
      topic: "Artículo en inglés",
      pauseForReview: false,
      language: "inglés",
      cfg: makeConfig(1),
      deps,
    });

    expect(result.status).toBe("completed");
    // El prompt del redactor (draft) lleva el idioma pedido en lugar del español fijo.
    expect(prompts.some((prompt) => prompt.includes("en inglés"))).toBe(true);
    // Y el idioma sobrevive en el contexto persistido (pausas, revisiones).
    expect(result.context.language).toBe("inglés");
  });
});
