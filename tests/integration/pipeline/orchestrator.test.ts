import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { DEFAULT_PIPELINE_PARAMS, DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import { resumeGeneration, reviseGeneration, startGeneration } from "@/lib/pipeline/orchestrator";
import {
  BlueprintSchema,
  EnrichStepOutputSchema,
  FactualReviewSchema,
  FactsSchema,
  FixerOutputSchema,
  QualityReviewSchema,
  ValidationReportSchema,
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
function makeDeps(options: { validatePasses: boolean; aiScore?: number }): PipelineDeps {
  const { validatePasses, aiScore = 30 } = options;

  const runObject: PipelineDeps["runObject"] = async ({ schema }) => {
    const s = schema as unknown;
    let object: unknown;

    if (s === FactsSchema) {
      object = { facts: [{ claim: "Un hecho", source: "https://e.example/0" }] };
    } else if (s === BlueprintSchema) {
      object = {
        title: "Titular",
        angle: "Ángulo",
        targetKeyword: "kw",
        sections: [{ heading: "H", summary: "S" }],
      };
    } else if (s === ValidationReportSchema) {
      object = validatePasses
        ? { passed: true, issues: [] }
        : {
            passed: false,
            issues: [{ category: "ai-tone", severity: "low", description: "d", suggestion: "s" }],
          };
    } else if (s === FactualReviewSchema) {
      object = {
        riskLevel: "low",
        claims: [{ claim: "Un hecho", status: "confirmed", reason: "En las fuentes" }],
        summary: "Sin riesgos.",
        researchSufficiency: { sufficient: true, reason: "Las fuentes son adecuadas." },
      };
    } else if (s === QualityReviewSchema) {
      object = {
        structureScore: 85,
        factualSupportScore: 90,
        seoScore: 80,
        wordCount: 300,
        aiScore,
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
    } else if (s === EnrichStepOutputSchema) {
      object = {
        headlineVariants: ["Titular alternativo"],
        tags: ["test", "e2e"],
        faq: [],
        imageAlt: ["Alt de prueba"],
        jsonLdNewsArticle: { "@context": "https://schema.org", "@type": "NewsArticle" },
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
    expect(result.context.enrichment?.aiDetection.label).toBe("humano"); // aiScore=30 → humano
    expect(result.context.enrichment?.qualitySummary.groundedness).toBe(100); // 1/1 confirmados

    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article?.title).toBe("Final");
    expect(JSON.parse(article?.keywords ?? "[]")).toEqual(["kw"]);
    // El enriquecimiento queda persistido en metadataJson para el historial.
    expect(article?.metadataJson).toBeTruthy();
    expect(JSON.parse(article?.metadataJson ?? "{}").tags).toEqual(["test", "e2e"]);
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

  it("itera el bucle validate↔fixer cuando la validación no pasa", async () => {
    const result = await startGeneration({
      userId,
      topic: "Cambio climático",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: false }),
    });

    expect(result.status).toBe("completed");
    const validateSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "validate" },
    });
    // Con maxFixIterations=2 y validación que nunca pasa, debe validar 2 veces.
    expect(validateSteps.length).toBe(2);
    const attempts = validateSteps.map((s) => s.attempt).sort();
    expect(attempts).toEqual([1, 2]);
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
    expect(validateSteps.length).toBe(2);
  });

  it("dispara una re-humanización cuando aiScore supera el umbral", async () => {
    // aiScore=85 > aiScoreThreshold=70 → debe humanizar 2 veces (1 inicial + 1 reintento).
    const result = await startGeneration({
      userId,
      topic: "Robótica",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: true, aiScore: 85 }),
    });

    expect(result.status).toBe("completed");
    const humanizeSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "humanize" },
    });
    // 1 humanize inicial + 1 re-humanización por aiScore alto.
    expect(humanizeSteps.length).toBe(2);
  });

  it("reviseGeneration regenera desde un borrador existente sin investigar", async () => {
    const result = await reviseGeneration({
      userId,
      topic: "Tema original",
      sourceContext: {
        topic: "Tema original",
        sources: [],
        facts: { facts: [{ claim: "Hecho previo", source: "https://e.example/0" }] },
        blueprint: { title: "T", angle: "A", targetKeyword: "kw", sections: [] },
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

    // Produce un artículo nuevo en un run nuevo.
    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article).not.toBeNull();
  });
});
