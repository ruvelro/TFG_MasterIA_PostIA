import { prisma } from "@/lib/db/client";
import {
  AI_STAGE_IDS,
  DEFAULT_STEP_CONFIG,
  type AiStageId,
  type StepConfig,
} from "@/lib/pipeline/default-config";

/**
 * Configuración por etapa del pipeline (modelo + prompt). Si una etapa no tiene fila en la
 * BD, se devuelve su valor por defecto, de modo que el sistema funciona "de fábrica" antes
 * de que el admin personalice nada.
 */
export async function getAllStepConfigs(): Promise<Record<AiStageId, StepConfig>> {
  const rows = await prisma.pipelineStepConfig.findMany();
  const byId = new Map(rows.map((row) => [row.stageId, row]));

  const result = {} as Record<AiStageId, StepConfig>;
  for (const stageId of AI_STAGE_IDS) {
    const row = byId.get(stageId);
    result[stageId] = {
      model: row?.model || DEFAULT_STEP_CONFIG[stageId].model,
      prompt: row?.prompt || DEFAULT_STEP_CONFIG[stageId].prompt,
    };
  }
  return result;
}

export async function setStepConfig(stageId: AiStageId, config: StepConfig): Promise<void> {
  await prisma.pipelineStepConfig.upsert({
    where: { stageId },
    update: { model: config.model, prompt: config.prompt },
    create: { stageId, model: config.model, prompt: config.prompt },
  });
}
