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

/** Se lanza cuando un override apunta a un modelo que no está en la allowlist. */
export class OverrideModelNotAllowedError extends Error {
  constructor(stageId: string, model: string) {
    super(`Modelo no permitido en el override de "${stageId}": ${model}`);
    this.name = "OverrideModelNotAllowedError";
  }
}

/**
 * Verifica que los modelos de los overrides puntuales pertenezcan al conjunto de modelos
 * PERMITIDOS (los que el admin tiene configurados por etapa). Sin esto, un usuario autenticado
 * podría fijar por API un modelo arbitrario y caro, gastando la clave de OpenRouter compartida.
 *
 * No restringe el `prompt` del override: su contenido es del propio usuario y su coste va
 * acotado por los límites de tamaño de entrada y por el rate limiting del endpoint.
 */
export function assertOverrideModelsAllowed(
  overrides: Partial<Record<AiStageId, StepOverride>> | undefined,
  allowedModels: ReadonlySet<string>,
): void {
  if (!overrides) return;
  for (const [stageId, override] of Object.entries(overrides)) {
    const model = override?.model?.trim();
    if (model && !allowedModels.has(model)) {
      throw new OverrideModelNotAllowedError(stageId, model);
    }
  }
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
