import { prisma } from "@/lib/db/client";
import type { Blueprint, Facts, LengthPreset, NewsType } from "@/lib/pipeline/schemas";
import type { StageId } from "@/lib/pipeline/stages";
import { computeAiDetection, computeQualitySummary } from "@/lib/pipeline/format";
import { runBlueprint } from "@/lib/pipeline/steps/blueprint";
import { runDraft } from "@/lib/pipeline/steps/draft";
import { runEditorialValidator } from "@/lib/pipeline/steps/editorial-validator";
import { runEnrich } from "@/lib/pipeline/steps/enrich";
import { runExtract } from "@/lib/pipeline/steps/extract";
import { runFactualReview } from "@/lib/pipeline/steps/factual-review";
import { runFixer } from "@/lib/pipeline/steps/fixer";
import { runHumanize } from "@/lib/pipeline/steps/humanize";
import { runQualityReview } from "@/lib/pipeline/steps/quality-review";
import { runResearch } from "@/lib/pipeline/steps/research";
import { runScrub } from "@/lib/pipeline/steps/scrub";
import { runValidate } from "@/lib/pipeline/steps/validate";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  RunStatus,
  StageEventHandler,
  TokenUsage,
} from "@/lib/pipeline/types";

const noop: StageEventHandler = () => {};

interface StageMeta {
  model?: string;
  usage?: TokenUsage;
}

/**
 * Ejecuta una etapa con instrumentación uniforme: emite eventos de progreso, mide duración
 * y persiste una fila `GenerationStep` (modelo, tokens, intento, estado). La lógica concreta
 * va en `fn`, que actualiza el contexto por cierre y devuelve los metadatos a registrar.
 */
async function executeStage(
  args: { runId: string; stageId: StageId; attempt: number; onEvent: StageEventHandler },
  fn: () => Promise<StageMeta>,
): Promise<void> {
  const { runId, stageId, attempt, onEvent } = args;
  onEvent({ stageId, status: "running", attempt });
  const startedAt = Date.now();

  try {
    const meta = await fn();
    await prisma.generationStep.create({
      data: {
        runId,
        stageId,
        attempt,
        status: "done",
        model: meta.model ?? null,
        durationMs: Date.now() - startedAt,
        tokensInput: meta.usage?.inputTokens ?? null,
        tokensOutput: meta.usage?.outputTokens ?? null,
      },
    });
    onEvent({ stageId, status: "done", attempt, model: meta.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.generationStep.create({
      data: {
        runId,
        stageId,
        attempt,
        status: "error",
        error: message,
        durationMs: Date.now() - startedAt,
      },
    });
    onEvent({ stageId, status: "error", attempt, message });
    throw error;
  }
}

async function saveContext(runId: string, ctx: PipelineContext, status: RunStatus): Promise<void> {
  await prisma.generationRun.update({
    where: { id: runId },
    data: { status, contextJson: JSON.stringify(ctx) },
  });
}

export interface GenerationResult {
  runId: string;
  status: RunStatus;
  context: PipelineContext;
  /** Id del `Article` creado (solo cuando la generación se completa). */
  articleId?: string;
}

export interface StartParams {
  userId: string;
  topic: string;
  /** Si es true, el pipeline se detiene tras la extracción para revisión humana de los hechos. */
  pauseForReview?: boolean;
  /** Si es true, el pipeline se detiene tras la estructura para revisión humana del blueprint. */
  pauseForBlueprintReview?: boolean;
  /** Tipo de noticia seleccionado (preset del pipeline). */
  newsType?: NewsType;
  /** Preset de longitud seleccionado. */
  lengthPreset?: LengthPreset;
  cfg: ResolvedPipelineConfig;
  deps: PipelineDeps;
  onEvent?: StageEventHandler;
}

/**
 * Arranca una generación: research + extract. Si `pauseForReview`, se detiene en
 * `awaiting_review` (persistiendo el contexto) para que el usuario revise/edite los hechos;
 * si no, continúa hasta el final.
 */
export async function startGeneration(params: StartParams): Promise<GenerationResult> {
  const {
    userId,
    topic,
    pauseForReview = true,
    pauseForBlueprintReview = false,
    newsType,
    lengthPreset,
    cfg,
    deps,
    onEvent = noop,
  } = params;
  const run = await prisma.generationRun.create({ data: { userId, topic, status: "researching" } });
  // El tipo de noticia y el preset de longitud viajan en el contexto: así sobreviven a las pausas
  // (se serializan) y rigen el pipeline tanto al arrancar como al reanudar.
  const ctx: PipelineContext = { topic, sources: [], newsType, lengthPreset };

  try {
    await executeStage({ runId: run.id, stageId: "research", attempt: 1, onEvent }, async () => {
      ctx.sources = await runResearch(ctx, cfg, deps);
      return {};
    });
    await executeStage({ runId: run.id, stageId: "extract", attempt: 1, onEvent }, async () => {
      const result = await runExtract(ctx, cfg, deps);
      ctx.facts = result.facts;
      return { model: result.model, usage: result.usage };
    });

    if (pauseForReview) {
      await saveContext(run.id, ctx, "awaiting_review");
      return { runId: run.id, status: "awaiting_review", context: ctx };
    }

    await saveContext(run.id, ctx, "generating");
    return await runGenerationTail(run.id, ctx, cfg, deps, onEvent, pauseForBlueprintReview);
  } catch (error) {
    await prisma.generationRun.update({ where: { id: run.id }, data: { status: "failed" } });
    throw error;
  }
}

export interface ResumeParams {
  runId: string;
  /** Hechos revisados/editados por el usuario; si se omiten, se usan los extraídos. */
  editedFacts?: Facts;
  /** Blueprint revisado/editado por el usuario tras la pausa de blueprint. */
  editedBlueprint?: Blueprint;
  cfg: ResolvedPipelineConfig;
  deps: PipelineDeps;
  onEvent?: StageEventHandler;
}

/**
 * Reanuda una generación pausada. Distingue el tipo de pausa según el estado del run:
 * - `awaiting_review`: pausa tras extracción de hechos.
 * - `awaiting_blueprint_review`: pausa tras diseño de la estructura.
 */
export async function resumeGeneration(params: ResumeParams): Promise<GenerationResult> {
  const { runId, editedFacts, editedBlueprint, cfg, deps, onEvent = noop } = params;
  const run = await prisma.generationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Generación no encontrada");
  if (run.status !== "awaiting_review" && run.status !== "awaiting_blueprint_review")
    throw new Error("La generación no está pendiente de revisión");
  if (!run.contextJson) throw new Error("Falta el contexto de la generación");

  const ctx = JSON.parse(run.contextJson) as PipelineContext;

  if (run.status === "awaiting_review") {
    if (editedFacts) ctx.facts = editedFacts;
  } else {
    // awaiting_blueprint_review
    if (editedBlueprint) ctx.blueprint = editedBlueprint;
  }

  try {
    await saveContext(runId, ctx, "generating");
    // Al reanudar desde blueprint-review no hay nueva pausa de blueprint.
    return await runGenerationTail(runId, ctx, cfg, deps, onEvent, false);
  } catch (error) {
    await prisma.generationRun.update({ where: { id: runId }, data: { status: "failed" } });
    throw error;
  }
}

export interface ReviseParams {
  userId: string;
  topic: string;
  /** Contexto del run original (hechos, estructura, fuentes, tipo, longitud). */
  sourceContext: PipelineContext;
  /** Markdown del artículo original, que se toma como borrador de partida. */
  sourceArticleMarkdown: string;
  /** Instrucciones de revisión que el corrector debe aplicar. */
  instructions: string;
  cfg: ResolvedPipelineConfig;
  deps: PipelineDeps;
  onEvent?: StageEventHandler;
}

/**
 * Reenvío dirigido (Revision Mode): regenera un artículo a partir de uno existente y unas
 * instrucciones, SIN volver a investigar. Reutiliza los hechos, la estructura y las fuentes del
 * run original; el borrador de partida es el artículo previo. Produce un artículo NUEVO.
 */
export async function reviseGeneration(params: ReviseParams): Promise<GenerationResult> {
  const {
    userId,
    topic,
    sourceContext,
    sourceArticleMarkdown,
    instructions,
    cfg,
    deps,
    onEvent = noop,
  } = params;

  if (!sourceContext.facts) {
    throw new Error("No se puede revisar: falta el contexto (hechos) de la generación original");
  }

  const run = await prisma.generationRun.create({ data: { userId, topic, status: "generating" } });
  const ctx: PipelineContext = {
    topic,
    sources: sourceContext.sources ?? [],
    facts: sourceContext.facts,
    blueprint: sourceContext.blueprint,
    newsType: sourceContext.newsType,
    lengthPreset: sourceContext.lengthPreset,
    draft: sourceArticleMarkdown,
    revisionInstructions: instructions,
  };

  try {
    await saveContext(run.id, ctx, "generating");
    return await runQualityAndFinalize(run.id, ctx, cfg, deps, onEvent);
  } catch (error) {
    await prisma.generationRun.update({ where: { id: run.id }, data: { status: "failed" } });
    throw error;
  }
}

/**
 * Parte final del pipeline: estructura → redacción → humanización → bucle de calidad
 * (validate + factual-review + quality-review ↔ fixer) → limpieza → artículo guardado.
 *
 * Si `pauseForBlueprintReview` es true, el orquestador se detiene justo después de
 * generar el blueprint para que el usuario lo revise antes de la redacción.
 */
async function runGenerationTail(
  runId: string,
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
  onEvent: StageEventHandler,
  pauseForBlueprintReview: boolean,
): Promise<GenerationResult> {
  // blueprint — se salta si ya existe (viene del resume de blueprint-review)
  if (!ctx.blueprint) {
    await executeStage({ runId, stageId: "blueprint", attempt: 1, onEvent }, async () => {
      const result = await runBlueprint(ctx, cfg, deps);
      ctx.blueprint = result.blueprint;
      return { model: result.model, usage: result.usage };
    });
  }

  if (pauseForBlueprintReview) {
    await saveContext(runId, ctx, "awaiting_blueprint_review");
    return { runId, status: "awaiting_blueprint_review", context: ctx };
  }

  await executeStage({ runId, stageId: "draft", attempt: 1, onEvent }, async () => {
    const result = await runDraft(ctx, cfg, deps);
    ctx.draft = result.draft;
    return { model: result.model, usage: result.usage };
  });

  // Humanización inicial (attempt 1), solo si el tipo la activa.
  if (ctx.newsType?.enableHumanize ?? true) {
    ctx.humanizeAttempts = 1;
    await executeStage({ runId, stageId: "humanize", attempt: 1, onEvent }, async () => {
      const result = await runHumanize(ctx, cfg, deps);
      ctx.draft = result.draft;
      return { model: result.model, usage: result.usage };
    });
  }

  return runQualityAndFinalize(runId, ctx, cfg, deps, onEvent);
}

/**
 * Bucle de calidad (validate + validador determinista + factual-review + quality-review ↔
 * fixer) seguido de la finalización (limpieza, métricas, enriquecimiento y guardado del
 * artículo). Se extrae aparte porque lo reutilizan tanto la generación normal como el reenvío
 * dirigido (Revision Mode), que parte de un borrador ya existente. Requiere `ctx.draft` listo.
 */
async function runQualityAndFinalize(
  runId: string,
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
  onEvent: StageEventHandler,
): Promise<GenerationResult> {
  // Toggles del tipo de noticia: si no hay tipo, se ejecutan todas las etapas (comportamiento
  // por defecto, retrocompatible). `research` nunca es opcional (fuente de verdad).
  const runHumanizeStage = ctx.newsType?.enableHumanize ?? true;
  const runFactualReviewStage = ctx.newsType?.enableFactualReview ?? true;
  const runQualityReviewStage = ctx.newsType?.enableQualityReview ?? true;

  // Bucle de calidad: validar → revisar → puntuar → corregir si es necesario.
  const maxIterations = Math.max(cfg.maxFixIterations, 1);
  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    await executeStage({ runId, stageId: "validate", attempt, onEvent }, async () => {
      const result = await runValidate(ctx, cfg, deps);
      ctx.report = result.report;
      return { model: result.model, usage: result.usage };
    });

    // Capa determinista (sin IA): fusiona sus hallazgos en el informe de validación. Los de
    // severidad alta marcan el informe como NO superado para que el corrector los resuelva.
    if (ctx.draft && ctx.report) {
      const editorialIssues = runEditorialValidator({
        draft: ctx.draft,
        sources: ctx.sources,
        forbiddenWords: cfg.forbiddenWords,
        config: cfg.validatorConfig,
      });
      if (editorialIssues.length > 0) {
        const hasBlocking = editorialIssues.some((issue) => issue.severity === "high");
        ctx.report = {
          passed: ctx.report.passed && !hasBlocking,
          issues: [...ctx.report.issues, ...editorialIssues],
        };
      }
    }

    if (runFactualReviewStage) {
      await executeStage({ runId, stageId: "factual-review", attempt, onEvent }, async () => {
        const result = await runFactualReview(ctx, cfg, deps);
        ctx.factualReport = result.factualReport;
        return { model: result.model, usage: result.usage };
      });
    }

    if (runQualityReviewStage) {
      await executeStage({ runId, stageId: "quality-review", attempt, onEvent }, async () => {
        const result = await runQualityReview(ctx, cfg, deps);
        ctx.qualityReport = result.qualityReport;
        return { model: result.model, usage: result.usage };
      });
    }

    // Re-humanización: solo si el tipo activa humanize Y quality-review (necesita el aiScore).
    const aiScore = ctx.qualityReport?.aiScore ?? 0;
    const needsHumanize =
      runHumanizeStage &&
      runQualityReviewStage &&
      aiScore >= cfg.aiScoreThreshold &&
      (ctx.humanizeAttempts ?? 0) < cfg.maxHumanizeRetries;

    // Si la validación pasa y el texto ya no suena a IA, el bucle puede terminar.
    if (ctx.report?.passed && !needsHumanize) break;

    if (needsHumanize) {
      ctx.humanizeAttempts = (ctx.humanizeAttempts ?? 0) + 1;
      await executeStage(
        { runId, stageId: "humanize", attempt: ctx.humanizeAttempts, onEvent },
        async () => {
          const result = await runHumanize(ctx, cfg, deps);
          ctx.draft = result.draft;
          return { model: result.model, usage: result.usage };
        },
      );
    }

    if (!ctx.report?.passed) {
      await executeStage({ runId, stageId: "fixer", attempt, onEvent }, async () => {
        const result = await runFixer(ctx, cfg, deps);
        ctx.article = result.article;
        ctx.draft = result.article.contentMarkdown;
        return { model: result.model, usage: result.usage };
      });
    }
  }

  // Si la validación pasó a la primera sin necesidad de fixer, aún falta producir el
  // artículo estructurado con la meta SEO; el fixer lo hace sin correcciones pendientes.
  if (!ctx.article) {
    await executeStage(
      { runId, stageId: "fixer", attempt: maxIterations + 1, onEvent },
      async () => {
        const result = await runFixer(ctx, cfg, deps);
        ctx.article = result.article;
        ctx.draft = result.article.contentMarkdown;
        return { model: result.model, usage: result.usage };
      },
    );
  }

  const article = ctx.article;
  if (!article) throw new Error("El fixer no produjo un artículo");

  // Limpieza determinista: elimina meta-referencias de investigación del texto final.
  await executeStage({ runId, stageId: "scrub", attempt: 1, onEvent }, async () => {
    ctx.article = {
      ...article,
      contentMarkdown: runScrub(article.contentMarkdown, cfg.scrubPatterns),
    };
    return {};
  });

  const cleanArticle = ctx.article!;

  // Enriquecimiento: primero se calculan las métricas derivadas (sin IA) y luego el step
  // enrich genera los campos creativos. El orquestador los une en un único objeto.
  const aiDetection = computeAiDetection(ctx.qualityReport?.aiScore ?? 0);
  const qualitySummary =
    ctx.report && ctx.factualReport && ctx.qualityReport
      ? computeQualitySummary(ctx.report, ctx.factualReport, ctx.qualityReport)
      : {
          groundedness: 100,
          aiDetectionScore: aiDetection.score,
          factualRisk: "low" as const,
          qualityRisk: "low" as const,
          warningsCount: 0,
        };

  await executeStage({ runId, stageId: "enrich", attempt: 1, onEvent }, async () => {
    const result = await runEnrich(ctx, cfg, deps);
    ctx.enrichment = { ...result.enrichStepOutput, aiDetection, qualitySummary };
    return { model: result.model, usage: result.usage };
  });

  const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: runId } });
  const created = await prisma.article.create({
    data: {
      userId: run.userId,
      runId,
      title: cleanArticle.title,
      slug: cleanArticle.slug,
      contentMarkdown: cleanArticle.contentMarkdown,
      metaDescription: cleanArticle.metaDescription,
      keywords: JSON.stringify(cleanArticle.keywords),
      metadataJson: ctx.enrichment ? JSON.stringify(ctx.enrichment) : null,
    },
    select: { id: true },
  });

  await saveContext(runId, ctx, "completed");
  return { runId, status: "completed", context: ctx, articleId: created.id };
}
