import type { StepOverride } from "@/lib/ai/resolve-step";
import { getArticleForUser } from "@/lib/articles/repository";
import { buildPipelineConfig, buildPipelineDeps } from "@/lib/pipeline/build-deps";
import {
  resumeGeneration,
  reviseGeneration,
  startGeneration,
  type GenerationResult,
} from "@/lib/pipeline/orchestrator";
import type { Blueprint, Facts } from "@/lib/pipeline/schemas";
import type { AiStageId } from "@/lib/pipeline/default-config";
import { resolveLengthPreset } from "@/lib/settings/length-presets";
import { resolveNewsType } from "@/lib/settings/news-types";
import type { PipelineContext, StageEventHandler } from "@/lib/pipeline/types";

/**
 * Capa de servicio: enlaza la configuración y dependencias REALES (claves y config de la BD)
 * con el orquestador. Es lo que invocará el endpoint HTTP (Fase 5). El orquestador en sí se
 * mantiene puro respecto a la fuente de configuración, para poder testearlo con dobles.
 */

export interface StartGenerationInput {
  userId: string;
  topic: string;
  context?: string;
  pauseForReview?: boolean;
  pauseForBlueprintReview?: boolean;
  newsTypeId?: string;
  lengthPresetId?: string;
  overrides?: Partial<Record<AiStageId, StepOverride>>;
}

export async function startGenerationForUser(
  input: StartGenerationInput,
  onEvent?: StageEventHandler,
): Promise<GenerationResult> {
  const [cfg, deps, newsType, lengthPreset] = await Promise.all([
    buildPipelineConfig(input.overrides),
    buildPipelineDeps(),
    resolveNewsType(input.newsTypeId),
    resolveLengthPreset(input.lengthPresetId),
  ]);
  return startGeneration({
    userId: input.userId,
    topic: input.topic,
    context: input.context,
    pauseForReview: input.pauseForReview,
    pauseForBlueprintReview: input.pauseForBlueprintReview,
    newsType,
    lengthPreset,
    cfg,
    deps,
    onEvent,
  });
}

export interface ResumeGenerationInput {
  runId: string;
  editedFacts?: Facts;
  editedBlueprint?: Blueprint;
  overrides?: Partial<Record<AiStageId, StepOverride>>;
}

export async function resumeGenerationForRun(
  input: ResumeGenerationInput,
  onEvent?: StageEventHandler,
): Promise<GenerationResult> {
  const [cfg, deps] = await Promise.all([
    buildPipelineConfig(input.overrides),
    buildPipelineDeps(),
  ]);
  return resumeGeneration({
    runId: input.runId,
    editedFacts: input.editedFacts,
    editedBlueprint: input.editedBlueprint,
    cfg,
    deps,
    onEvent,
  });
}

export interface ReviseGenerationInput {
  userId: string;
  articleId: string;
  instructions: string;
}

/**
 * Reenvío dirigido: revisa un artículo existente del usuario aplicando instrucciones, sin nueva
 * investigación. Verifica la PROPIEDAD del artículo (vía el repositorio) y reutiliza el contexto
 * (hechos, estructura, fuentes) del run que lo generó.
 */
export async function reviseGenerationForUser(
  input: ReviseGenerationInput,
  onEvent?: StageEventHandler,
): Promise<GenerationResult> {
  const article = await getArticleForUser(input.articleId, input.userId);
  if (!article) {
    throw new Error("Artículo no encontrado");
  }
  if (!article.run?.contextJson) {
    throw new Error("El artículo original no conserva el contexto necesario para revisarlo");
  }

  const sourceContext = JSON.parse(article.run.contextJson) as PipelineContext;
  const [cfg, deps] = await Promise.all([buildPipelineConfig(), buildPipelineDeps()]);

  return reviseGeneration({
    userId: input.userId,
    topic: article.run.topic,
    sourceContext,
    sourceArticleMarkdown: article.contentMarkdown,
    instructions: input.instructions,
    cfg,
    deps,
    onEvent,
  });
}
