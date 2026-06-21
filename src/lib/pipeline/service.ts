import type { StepOverride } from "@/lib/ai/resolve-step";
import { buildPipelineConfig, buildPipelineDeps } from "@/lib/pipeline/build-deps";
import {
  resumeGeneration,
  startGeneration,
  type GenerationResult,
} from "@/lib/pipeline/orchestrator";
import type { Facts } from "@/lib/pipeline/schemas";
import type { AiStageId } from "@/lib/pipeline/default-config";
import type { StageEventHandler } from "@/lib/pipeline/types";

/**
 * Capa de servicio: enlaza la configuración y dependencias REALES (claves y config de la BD)
 * con el orquestador. Es lo que invocará el endpoint HTTP (Fase 5). El orquestador en sí se
 * mantiene puro respecto a la fuente de configuración, para poder testearlo con dobles.
 */

export interface StartGenerationInput {
  userId: string;
  topic: string;
  pauseForReview?: boolean;
  overrides?: Partial<Record<AiStageId, StepOverride>>;
}

export async function startGenerationForUser(
  input: StartGenerationInput,
  onEvent?: StageEventHandler,
): Promise<GenerationResult> {
  const [cfg, deps] = await Promise.all([
    buildPipelineConfig(input.overrides),
    buildPipelineDeps(),
  ]);
  return startGeneration({
    userId: input.userId,
    topic: input.topic,
    pauseForReview: input.pauseForReview,
    cfg,
    deps,
    onEvent,
  });
}

export interface ResumeGenerationInput {
  runId: string;
  editedFacts?: Facts;
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
    cfg,
    deps,
    onEvent,
  });
}
