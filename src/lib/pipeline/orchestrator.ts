import { prisma } from "@/lib/db/client";
import type { Facts } from "@/lib/pipeline/schemas";
import type { StageId } from "@/lib/pipeline/stages";
import { runBlueprint } from "@/lib/pipeline/steps/blueprint";
import { runDraft } from "@/lib/pipeline/steps/draft";
import { runExtract } from "@/lib/pipeline/steps/extract";
import { runFixer } from "@/lib/pipeline/steps/fixer";
import { runResearch } from "@/lib/pipeline/steps/research";
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
  /** Si es true, el pipeline se detiene tras la extracción para revisión humana. */
  pauseForReview?: boolean;
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
  const { userId, topic, pauseForReview = true, cfg, deps, onEvent = noop } = params;
  const run = await prisma.generationRun.create({ data: { userId, topic, status: "researching" } });
  const ctx: PipelineContext = { topic, sources: [] };

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
    return await runGenerationTail(run.id, ctx, cfg, deps, onEvent);
  } catch (error) {
    await prisma.generationRun.update({ where: { id: run.id }, data: { status: "failed" } });
    throw error;
  }
}

export interface ResumeParams {
  runId: string;
  /** Hechos revisados/editados por el usuario; si se omiten, se usan los extraídos. */
  editedFacts?: Facts;
  cfg: ResolvedPipelineConfig;
  deps: PipelineDeps;
  onEvent?: StageEventHandler;
}

/** Reanuda una generación pausada en revisión: blueprint → draft → bucle → artículo. */
export async function resumeGeneration(params: ResumeParams): Promise<GenerationResult> {
  const { runId, editedFacts, cfg, deps, onEvent = noop } = params;
  const run = await prisma.generationRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Generación no encontrada");
  if (run.status !== "awaiting_review")
    throw new Error("La generación no está pendiente de revisión");
  if (!run.contextJson) throw new Error("Falta el contexto de la generación");

  const ctx = JSON.parse(run.contextJson) as PipelineContext;
  if (editedFacts) ctx.facts = editedFacts;

  try {
    await saveContext(runId, ctx, "generating");
    return await runGenerationTail(runId, ctx, cfg, deps, onEvent);
  } catch (error) {
    await prisma.generationRun.update({ where: { id: runId }, data: { status: "failed" } });
    throw error;
  }
}

/**
 * Parte final del pipeline: estructura, redacción y el bucle de calidad validate↔fixer.
 * El fixer corrige y, a la vez, produce el artículo estructurado (con su meta SEO); por eso
 * siempre se ejecuta al menos una vez antes de persistir el `Article`.
 */
async function runGenerationTail(
  runId: string,
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
  onEvent: StageEventHandler,
): Promise<GenerationResult> {
  await executeStage({ runId, stageId: "blueprint", attempt: 1, onEvent }, async () => {
    const result = await runBlueprint(ctx, cfg, deps);
    ctx.blueprint = result.blueprint;
    return { model: result.model, usage: result.usage };
  });

  await executeStage({ runId, stageId: "draft", attempt: 1, onEvent }, async () => {
    const result = await runDraft(ctx, cfg, deps);
    ctx.draft = result.draft;
    return { model: result.model, usage: result.usage };
  });

  // Bucle acotado: validar y, si no pasa, corregir; re-validar hasta pasar o agotar intentos.
  const maxIterations = Math.max(cfg.maxFixIterations, 1);
  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    await executeStage({ runId, stageId: "validate", attempt, onEvent }, async () => {
      const result = await runValidate(ctx, cfg, deps);
      ctx.report = result.report;
      return { model: result.model, usage: result.usage };
    });

    if (ctx.report?.passed) break;

    await executeStage({ runId, stageId: "fixer", attempt, onEvent }, async () => {
      const result = await runFixer(ctx, cfg, deps);
      ctx.article = result.article;
      ctx.draft = result.article.contentMarkdown; // el texto corregido se re-valida en la vuelta siguiente
      return { model: result.model, usage: result.usage };
    });
  }

  // Si la validación pasó a la primera, aún no hay artículo estructurado: el fixer lo
  // produce (formato + meta SEO) sin más correcciones que aplicar.
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

  const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: runId } });
  const created = await prisma.article.create({
    data: {
      userId: run.userId,
      runId,
      title: article.title,
      slug: article.slug,
      contentMarkdown: article.contentMarkdown,
      metaDescription: article.metaDescription,
      keywords: JSON.stringify(article.keywords),
    },
    select: { id: true },
  });

  await saveContext(runId, ctx, "completed");
  return { runId, status: "completed", context: ctx, articleId: created.id };
}
