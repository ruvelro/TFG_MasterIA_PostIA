import { generateObject, generateText } from "ai";
import type { z } from "zod";

import { createOpenRouterModel } from "@/lib/ai/openrouter";

export interface GenerateParams {
  apiKey: string;
  modelId: string;
  system?: string;
  prompt: string;
  /** Señal de aborto: si el cliente cancela, la llamada de IA en curso se interrumpe. */
  abortSignal?: AbortSignal;
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
    abortSignal: params.abortSignal,
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
    abortSignal: params.abortSignal,
  });

  return {
    object: result.object,
    usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
  };
}
