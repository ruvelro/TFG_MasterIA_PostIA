import { generateObject, generateText } from "ai";
import type { z } from "zod";

import { createOpenRouterModel } from "@/lib/ai/openrouter";

/**
 * Reintentos automáticos por llamada. OpenRouter devuelve errores transitorios (429, 5xx) con
 * cierta frecuencia; el AI SDK reintenta con backoff exponencial. El pipeline encadena ~11
 * llamadas, así que un fallo puntual no debe tumbar toda la generación.
 */
const MAX_RETRIES = 2;

/**
 * Tiempo máximo por llamada de IA. Sin él, una etapa colgada bloquearía la generación
 * indefinidamente (y mantendría la conexión de streaming abierta). 2 minutos cubre incluso a
 * los modelos lentos con prompts largos.
 */
const REQUEST_TIMEOUT_MS = 120_000;

export interface GenerateParams {
  apiKey: string;
  modelId: string;
  system?: string;
  prompt: string;
  /** Señal de aborto: si el cliente cancela, la llamada de IA en curso se interrumpe. */
  abortSignal?: AbortSignal;
}

/**
 * Combina la cancelación del usuario con un timeout por llamada. Si el cliente cancela O se
 * agota el tiempo, la señal resultante se aborta y el AI SDK interrumpe la petición. Se expone
 * para poder testear la composición de señales de forma aislada.
 */
export function buildAbortSignal(userSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return userSignal ? AbortSignal.any([userSignal, timeout]) : timeout;
}

export interface TextGenerationResult {
  text: string;
  usage: { inputTokens?: number; outputTokens?: number };
}

/**
 * Genera texto libre con un modelo de OpenRouter. Es una fina envoltura sobre el AI SDK que
 * fija nuestro punto de integración: así el pipeline depende de esta función, no del SDK
 * directamente, y el modelo concreto se decide a partir de la configuración por etapa.
 */
export async function runTextGeneration(params: GenerateParams): Promise<TextGenerationResult> {
  const result = await generateText({
    model: createOpenRouterModel(params.apiKey, params.modelId),
    system: params.system,
    prompt: params.prompt,
    maxRetries: MAX_RETRIES,
    abortSignal: buildAbortSignal(params.abortSignal),
  });

  return {
    text: result.text,
    usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
  };
}

export interface ObjectGenerationResult<T> {
  object: T;
  usage: { inputTokens?: number; outputTokens?: number };
}

/**
 * Genera un objeto estructurado validado contra un esquema Zod (p. ej. el esquema del
 * outline o del informe de validación). El AI SDK fuerza al modelo a producir esa forma.
 */
export async function runObjectGeneration<T>(
  params: GenerateParams & { schema: z.ZodType<T> },
): Promise<ObjectGenerationResult<T>> {
  const result = await generateObject({
    model: createOpenRouterModel(params.apiKey, params.modelId),
    schema: params.schema,
    system: params.system,
    prompt: params.prompt,
    maxRetries: MAX_RETRIES,
    abortSignal: buildAbortSignal(params.abortSignal),
  });

  return {
    object: result.object,
    usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
  };
}
