import {
  DEFAULT_STEP_CONFIG,
  type AiStageId,
  type StepConfig,
} from "@/lib/pipeline/default-config";

/** Override puntual de una generación concreta (lo que el usuario ajusta al lanzarla). */
export interface StepOverride {
  model?: string;
  prompt?: string;
}

/** Devuelve el primer valor no vacío (ignorando espacios), o undefined. */
function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim().length > 0) return value;
  }
  return undefined;
}

/**
 * Resuelve la configuración efectiva de una etapa con esta precedencia:
 *   override puntual  >  configuración guardada (admin)  >  valores por defecto.
 *
 * Centralizar esta lógica evita que la precedencia se reimplemente (mal) en cada sitio que
 * necesite saber qué modelo y prompt usar.
 */
export function resolveStepConfig(
  stageId: AiStageId,
  stored?: Partial<StepConfig> | null,
  override?: StepOverride,
): StepConfig {
  const base = DEFAULT_STEP_CONFIG[stageId];
  return {
    model: firstNonEmpty(override?.model, stored?.model, base.model) ?? base.model,
    prompt: firstNonEmpty(override?.prompt, stored?.prompt, base.prompt) ?? base.prompt,
  };
}
