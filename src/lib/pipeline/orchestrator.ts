import { prisma } from "@/lib/db/client";
import { logError } from "@/lib/observability/error-log";
import { parsePipelineContext } from "@/lib/pipeline/context-schema";
import { getSourcesByRun, saveSources } from "@/lib/pipeline/sources-repository";
import type {
  Blueprint,
  Facts,
  LengthPreset,
  NewsType,
  ValidationIssue,
} from "@/lib/pipeline/schemas";
import type { StageId } from "@/lib/pipeline/stages";
import {
  computeAiDetection,
  computeNewsArticleJsonLd,
  computeQualityRisk,
  computeQualitySummary,
} from "@/lib/pipeline/format";
import { runBlueprint } from "@/lib/pipeline/steps/blueprint";
import { runDraft } from "@/lib/pipeline/steps/draft";
import { runEditorialValidator } from "@/lib/pipeline/steps/editorial-validator";
import { runEnrich } from "@/lib/pipeline/steps/enrich";
import { runExtract } from "@/lib/pipeline/steps/extract";
import { runFactualReview } from "@/lib/pipeline/steps/factual-review";
import { runArticleFinalizer, runFixer } from "@/lib/pipeline/steps/fixer";
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

function mergeValidationIssues(...groups: ValidationIssue[][]): ValidationIssue[] {
  const severityRank = { low: 0, medium: 1, high: 2 } as const;
  const unique = new Map<string, ValidationIssue>();

  for (const issue of groups.flat()) {
    const key = `${issue.category}:${issue.description}`;
    const current = unique.get(key);
    if (!current || severityRank[issue.severity] > severityRank[current.severity]) {
      unique.set(key, issue);
    }
  }

  return [...unique.values()];
}

function isFactualReviewAccepted(ctx: PipelineContext): boolean {
  return ctx.factualReport?.riskLevel === "low" && ctx.factualReport.researchSufficiency.sufficient;
}

/**
 * True si el error procede de una CANCELACIÓN (el usuario abortó el stream y la señal se
 * propagó a las llamadas de IA), no de un fallo real. Distinguirlo permite persistir el
 * estado `cancelled` y no contaminar las métricas de fiabilidad ni el log de errores.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Estado terminal de un run que no llegó a completarse: cancelado o fallido. */
function terminalStatus(error: unknown): RunStatus {
  return isAbortError(error) ? "cancelled" : "failed";
}

interface StageMeta {
  model?: string;
  usage?: TokenUsage;
  /** Salida de la etapa para mostrarla en el desplegable de detalle de la UI (fuentes, hechos…). */
  data?: unknown;
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
    onEvent({ stageId, status: "done", attempt, model: meta.model, data: meta.data });
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
    // Registro unificado para el panel de monitorización (best-effort, además de la fila de
    // traza). Las cancelaciones del usuario no son fallos: no ensucian el log de errores.
    if (!isAbortError(error)) {
      await logError({
        category: "pipeline",
        message: `Fallo en la etapa "${stageId}": ${message}`,
        detail: `runId: ${runId} · intento: ${attempt}${
          error instanceof Error && error.stack ? `\n${error.stack}` : ""
        }`,
      });
    }
    onEvent({ stageId, status: "error", attempt, message });
    throw error;
  }
}

/**
 * Serializa el contexto para `contextJson` SIN el contenido descargado de las fuentes: ese
 * cuerpo (potencialmente cientos de KB por web) vive en la tabla `GenerationSource` y se
 * rehidrata al reanudar. Conservamos solo los metadatos ligeros de cada fuente.
 */
function serializeContext(ctx: PipelineContext): string {
  const lean: PipelineContext = {
    ...ctx,
    sources: ctx.sources.map((source) => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet,
      content: "",
    })),
  };
  return JSON.stringify(lean);
}

async function saveContext(runId: string, ctx: PipelineContext, status: RunStatus): Promise<void> {
  await prisma.generationRun.update({
    where: { id: runId },
    data: { status, contextJson: serializeContext(ctx) },
  });
}

/**
 * Calcula y persiste el coste estimado (USD) de cada etapa del run a partir de sus tokens y los
 * precios de OpenRouter (vía `deps.estimateCost`). Se hace al finalizar, cuando ya existen todas
 * las filas `GenerationStep`, y se congela el coste con el precio del momento. Best-effort: el
 * coste es instrumentación informativa, así que un fallo al estimar nunca tumba la finalización.
 */
async function persistStepCosts(runId: string, deps: PipelineDeps): Promise<void> {
  try {
    const steps = await prisma.generationStep.findMany({
      where: { runId },
      select: { id: true, model: true, tokensInput: true, tokensOutput: true },
    });

    // Estimamos en paralelo (lecturas del catálogo cacheado, sin escritura) y nos quedamos solo
    // con las etapas que tienen coste calculable.
    const estimates = await Promise.all(
      steps.map(async (step) => ({
        id: step.id,
        costUsd: await deps.estimateCost(step.model, step.tokensInput, step.tokensOutput),
      })),
    );
    const updates = estimates
      .filter((e): e is { id: string; costUsd: number } => e.costUsd != null)
      .map((e) =>
        prisma.generationStep.update({ where: { id: e.id }, data: { costUsd: e.costUsd } }),
      );

    // Un único $transaction agrupa las N escrituras (SQLite no admite update masivo con valores
    // distintos por fila), evitando N round-trips sueltos y dejando el coste del run consistente.
    if (updates.length > 0) await prisma.$transaction(updates);
  } catch (error) {
    // Best-effort: el coste es instrumentación, no debe tumbar la entrega del artículo. Pero ya
    // no lo tragamos en silencio: lo registramos para poder detectar fallos de persistencia.
    await logError({
      category: "pipeline",
      message: "No se pudieron persistir los costes de las etapas",
      detail: `runId=${runId}: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
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
  /** Contexto adicional del usuario (datos, enlaces, matices) que se inyecta en los prompts. */
  context?: string;
  /** Idioma del artículo (texto libre para los prompts); si falta, español. */
  language?: string;
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
    context,
    language,
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
  // (se serializan) y rigen el pipeline tanto al arrancar como al reanudar. El flag de revisión de
  // estructura también se persiste para que sobreviva a la pausa de extracción.
  const ctx: PipelineContext = {
    topic,
    sources: [],
    newsType,
    lengthPreset,
    context,
    language,
    pauseForBlueprintReview,
  };

  try {
    await executeStage({ runId: run.id, stageId: "research", attempt: 1, onEvent }, async () => {
      const result = await runResearch(ctx, cfg, deps);
      ctx.sources = result.sources;
      // Las fuentes (con su contenido) se persisten normalizadas: así sobreviven a la pausa de
      // revisión sin inflar el contextJson y se rehidratan al reanudar/revisar.
      await saveSources(run.id, ctx.sources);
      // El modelo/tokens (si hubo expansión de consultas) van a la traza de coste de research.
      return { model: result.model, usage: result.usage, data: ctx.sources };
    });
    await executeStage({ runId: run.id, stageId: "extract", attempt: 1, onEvent }, async () => {
      const result = await runExtract(ctx, cfg, deps);
      ctx.facts = result.facts;
      return { model: result.model, usage: result.usage, data: result.facts };
    });

    if (pauseForReview) {
      await saveContext(run.id, ctx, "awaiting_review");
      return { runId: run.id, status: "awaiting_review", context: ctx };
    }

    await saveContext(run.id, ctx, "generating");
    return await runGenerationTail(run.id, ctx, cfg, deps, onEvent, pauseForBlueprintReview);
  } catch (error) {
    await prisma.generationRun.update({
      where: { id: run.id },
      data: { status: terminalStatus(error) },
    });
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

  const ctx = parsePipelineContext(run.contextJson);

  // Rehidratamos las fuentes (con su contenido) desde la tabla, ya que el contextJson solo
  // guarda sus metadatos. Si no hay filas (runs anteriores a la normalización), conservamos
  // las que viniesen en el snapshot por retrocompatibilidad.
  const storedSources = await getSourcesByRun(runId);
  if (storedSources.length > 0) ctx.sources = storedSources;

  // Al reanudar desde la pausa de extracción, el flag de revisión de estructura (persistido en el
  // contexto) sigue vigente; desde la pausa de blueprint ya no hay nueva pausa que aplicar.
  let pauseForBlueprintReview = false;
  if (run.status === "awaiting_review") {
    if (editedFacts) ctx.facts = editedFacts;
    pauseForBlueprintReview = ctx.pauseForBlueprintReview ?? false;
  } else {
    // awaiting_blueprint_review
    if (editedBlueprint) ctx.blueprint = editedBlueprint;
  }

  try {
    await saveContext(runId, ctx, "generating");
    return await runGenerationTail(runId, ctx, cfg, deps, onEvent, pauseForBlueprintReview);
  } catch (error) {
    await prisma.generationRun.update({
      where: { id: runId },
      data: { status: terminalStatus(error) },
    });
    throw error;
  }
}

export interface ReviseParams {
  userId: string;
  topic: string;
  /** Id del artículo original: el nuevo artículo queda enlazado como su revisión (hijo). */
  sourceArticleId?: string;
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
    sourceArticleId,
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
    language: sourceContext.language,
    draft: sourceArticleMarkdown,
    revisionInstructions: instructions,
    parentArticleId: sourceArticleId,
  };

  try {
    await saveContext(run.id, ctx, "generating");
    return await runQualityAndFinalize(run.id, ctx, cfg, deps, onEvent);
  } catch (error) {
    await prisma.generationRun.update({
      where: { id: run.id },
      data: { status: terminalStatus(error) },
    });
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
      return { model: result.model, usage: result.usage, data: result.blueprint };
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

  const reviewCurrentDraft = async (attempt: number): Promise<void> => {
    await executeStage({ runId, stageId: "validate", attempt, onEvent }, async () => {
      const result = await runValidate(ctx, cfg, deps);
      ctx.report = result.report;
      return { model: result.model, usage: result.usage, data: result.report };
    });

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
          issues: mergeValidationIssues(ctx.report.issues, editorialIssues),
        };
      }
    }

    if (runFactualReviewStage) {
      await executeStage({ runId, stageId: "factual-review", attempt, onEvent }, async () => {
        const result = await runFactualReview(ctx, cfg, deps);
        ctx.factualReport = result.factualReport;
        return { model: result.model, usage: result.usage, data: result.factualReport };
      });
    }

    if (runQualityReviewStage) {
      await executeStage({ runId, stageId: "quality-review", attempt, onEvent }, async () => {
        const result = await runQualityReview(ctx, cfg, deps);
        ctx.qualityReport = result.qualityReport;
        return { model: result.model, usage: result.usage, data: result.qualityReport };
      });
    }
  };

  const fixCurrentDraft = async (attempt: number): Promise<void> => {
    await executeStage({ runId, stageId: "fixer", attempt, onEvent }, async () => {
      const result = await runFixer(ctx, cfg, deps);
      ctx.draft = result.article.contentMarkdown;
      ctx.article = undefined;
      return { model: result.model, usage: result.usage };
    });
  };

  // Humanize y fixer tienen presupuestos independientes. Primero se resuelven los problemas
  // factuales, editoriales y SEO; cuando solo queda el tono IA, la última humanización pule el
  // texto ya corregido. Cada transformación se vuelve a medir antes de decidir la siguiente.
  let reviewAttempt = 0;
  let fixerAttempts = 0;
  for (;;) {
    reviewAttempt += 1;
    await reviewCurrentDraft(reviewAttempt);

    const aiScore = ctx.qualityReport?.aiScore ?? 0;
    const aiScoreAccepted = !runQualityReviewStage || aiScore < cfg.aiScoreThreshold;
    const needsHumanize =
      runHumanizeStage &&
      runQualityReviewStage &&
      !aiScoreAccepted &&
      (ctx.humanizeAttempts ?? 0) < cfg.maxHumanizeRetries;
    const factualRiskAccepted = !runFactualReviewStage || isFactualReviewAccepted(ctx);
    const qualityRiskAccepted =
      !runQualityReviewStage ||
      (ctx.qualityReport !== undefined && computeQualityRisk(ctx.qualityReport) === "low");
    const validationPassed = ctx.report?.passed ?? false;
    const validationIssues = ctx.report?.issues ?? [];
    const hasNonAiValidationIssue =
      !validationPassed &&
      (validationIssues.length === 0 ||
        validationIssues.some((issue) => issue.category !== "ai-tone"));
    const needsEditorialFix =
      hasNonAiValidationIssue || !factualRiskAccepted || !qualityRiskAccepted;
    const draftAccepted =
      validationPassed && aiScoreAccepted && factualRiskAccepted && qualityRiskAccepted;

    if (draftAccepted) break;

    if (needsEditorialFix && fixerAttempts < cfg.maxFixIterations) {
      fixerAttempts += 1;
      await fixCurrentDraft(fixerAttempts);
      continue;
    }

    if (needsHumanize) {
      ctx.humanizeAttempts = (ctx.humanizeAttempts ?? 0) + 1;
      await executeStage(
        { runId, stageId: "humanize", attempt: ctx.humanizeAttempts, onEvent },
        async () => {
          const result = await runHumanize(ctx, cfg, deps);
          ctx.draft = result.draft;
          ctx.article = undefined;
          return { model: result.model, usage: result.usage };
        },
      );
      continue;
    }

    // Si el juez sigue suspendiendo el artículo por un motivo puramente estilístico después de
    // agotar humanize, el fixer conserva la oportunidad de corregirlo antes de entregarlo.
    if (fixerAttempts < cfg.maxFixIterations) {
      fixerAttempts += 1;
      await fixCurrentDraft(fixerAttempts);
      continue;
    }

    break;
  }

  // La metadata se genera con un esquema separado. El cuerpo revisado se copia literalmente,
  // incluso si agotó el presupuesto y queda pendiente de revisión humana.
  await executeStage({ runId, stageId: "fixer", attempt: fixerAttempts + 1, onEvent }, async () => {
    const result = await runArticleFinalizer(ctx, cfg, deps);
    ctx.article = result.article;
    return { model: result.model, usage: result.usage };
  });

  const article = ctx.article;
  if (!article) throw new Error("El finalizador no produjo un artículo");

  // Limpieza determinista: elimina meta-referencias de investigación del texto final.
  await executeStage({ runId, stageId: "scrub", attempt: 1, onEvent }, async () => {
    ctx.article = {
      ...article,
      contentMarkdown: runScrub(article.contentMarkdown, cfg.scrubPatterns),
    };
    ctx.draft = ctx.article.contentMarkdown;
    return {};
  });

  const cleanArticle = ctx.article!;

  // Comprobación final sobre el Markdown exacto que se guardará, ya pasado por scrub.
  await executeStage(
    { runId, stageId: "validate", attempt: reviewAttempt + 1, onEvent },
    async () => {
      const finalIssues = runEditorialValidator({
        draft: cleanArticle.contentMarkdown,
        sources: ctx.sources,
        forbiddenWords: cfg.forbiddenWords,
        config: cfg.validatorConfig,
      });
      const hasBlocking = finalIssues.some((issue) => issue.severity === "high");
      ctx.report = {
        passed: (ctx.report?.passed ?? false) && !hasBlocking,
        issues: mergeValidationIssues(ctx.report?.issues ?? [], finalIssues),
      };
      return { data: ctx.report };
    },
  );

  const aiScoreAccepted =
    !runQualityReviewStage || (ctx.qualityReport?.aiScore ?? 0) < cfg.aiScoreThreshold;
  const factualRiskAccepted = !runFactualReviewStage || isFactualReviewAccepted(ctx);
  const qualityRiskAccepted =
    !runQualityReviewStage ||
    (ctx.qualityReport !== undefined && computeQualityRisk(ctx.qualityReport) === "low");
  const validationPassed =
    (ctx.report?.passed ?? false) && aiScoreAccepted && factualRiskAccepted && qualityRiskAccepted;
  if (!validationPassed) {
    await logError({
      category: "pipeline",
      message: "Artículo pendiente de revisión editorial (se agotaron las correcciones)",
      detail: `runId: ${runId} · humanizaciones: ${ctx.humanizeAttempts ?? 0} · correcciones: ${fixerAttempts}`,
    });
  }

  // Enriquecimiento: primero se calculan las métricas derivadas (sin IA) y luego el step
  // enrich genera los campos creativos. El orquestador los une en un único objeto.
  const aiDetection = computeAiDetection(ctx.qualityReport?.aiScore ?? 0);
  const qualitySummary =
    ctx.report && ctx.factualReport && ctx.qualityReport
      ? computeQualitySummary(ctx.report, ctx.factualReport, ctx.qualityReport, validationPassed)
      : {
          groundedness: 100,
          aiDetectionScore: aiDetection.score,
          factualRisk: "low" as const,
          qualityRisk: "low" as const,
          warningsCount: 0,
          validationPassed,
        };

  const jsonLdNewsArticle = computeNewsArticleJsonLd(cleanArticle);

  await executeStage({ runId, stageId: "enrich", attempt: 1, onEvent }, async () => {
    const result = await runEnrich(ctx, cfg, deps);
    ctx.enrichment = {
      ...result.enrichStepOutput,
      aiDetection,
      qualitySummary,
      jsonLdNewsArticle,
    };
    return { model: result.model, usage: result.usage, data: ctx.enrichment };
  });

  // Imagen destacada (etapa 12, opcional): requiere que el tipo la active Y que el admin
  // tenga un modelo de imagen configurado. Es un complemento del artículo, no su núcleo:
  // si el modelo falla, la etapa queda registrada como error pero la generación SIGUE y
  // entrega el artículo sin imagen (degradación elegante).
  const runFeatureImageStage =
    (ctx.newsType?.enableFeatureImage ?? false) &&
    cfg.featureImageModel.length > 0 &&
    Boolean(ctx.enrichment?.featuredImagePrompt);
  if (runFeatureImageStage) {
    try {
      await executeStage({ runId, stageId: "feature-image", attempt: 1, onEvent }, async () => {
        const image = await deps.runImage({
          modelId: cfg.featureImageModel,
          prompt: ctx.enrichment!.featuredImagePrompt,
        });
        ctx.featuredImagePath = await deps.storeImage({
          runId,
          imageBase64: image.imageBase64,
          mediaType: image.mediaType,
        });
        return { model: cfg.featureImageModel, usage: image.usage };
      });
    } catch {
      // Ya registrado por executeStage (fila de traza + log). El artículo se entrega sin imagen.
    }
  }

  // Coste por etapa (informativo): se calcula y persiste cuando ya existen todas las filas.
  await persistStepCosts(runId, deps);

  const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: runId } });

  const finalStatus: RunStatus = validationPassed ? "completed" : "needs_review";

  // Atomicidad: crear el artículo y marcar el estado final deben ocurrir juntos. Si
  // fueran dos escrituras sueltas, un fallo entre medias dejaría un artículo huérfano con el
  // run sin terminar. La transacción garantiza la invariante "artículo creado ⟺ run terminal".
  const [created] = await prisma.$transaction([
    prisma.article.create({
      data: {
        userId: run.userId,
        runId,
        title: cleanArticle.title,
        slug: cleanArticle.slug,
        contentMarkdown: cleanArticle.contentMarkdown,
        metaDescription: cleanArticle.metaDescription,
        keywords: JSON.stringify(cleanArticle.keywords),
        metadataJson: ctx.enrichment ? JSON.stringify(ctx.enrichment) : null,
        featuredImagePath: ctx.featuredImagePath ?? null,
        parentId: ctx.parentArticleId ?? null,
      },
      select: { id: true },
    }),
    prisma.generationRun.update({
      where: { id: runId },
      data: { status: finalStatus, contextJson: serializeContext(ctx) },
    }),
  ]);

  return { runId, status: finalStatus, context: ctx, articleId: created.id };
}
