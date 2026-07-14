import { generateObject, generateText, NoObjectGeneratedError } from "ai";
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
  /** Reintentos por llamada; cae a `MAX_RETRIES` si no se indica (configurable por el admin). */
  maxRetries?: number;
  /** Timeout por llamada en ms; cae a `REQUEST_TIMEOUT_MS` si no se indica. */
  timeoutMs?: number;
}

/**
 * Combina la cancelación del usuario con un timeout por llamada. Si el cliente cancela O se
 * agota el tiempo, la señal resultante se aborta y el AI SDK interrumpe la petición. Se expone
 * para poder testear la composición de señales de forma aislada.
 */
export function buildAbortSignal(
  userSignal?: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
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
    maxRetries: params.maxRetries ?? MAX_RETRIES,
    abortSignal: buildAbortSignal(params.abortSignal, params.timeoutMs),
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

function extractJsonCandidate(text: string): string | null {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenceMatch?.[1] ?? cleaned;
  const start = source.search(/[\[{]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char !== "}" && char !== "]") continue;

    const opening = stack.pop();
    const expected = opening === "{" ? "}" : "]";
    if (char !== expected) return null;
    if (stack.length === 0) return source.slice(start, index + 1);
  }

  return null;
}

function normalizeJsonCandidate(candidate: string): string[] {
  const normalized = candidate
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
  return normalized === candidate ? [candidate] : [candidate, normalized];
}

export async function repairStructuredObjectText(options: {
  text: string;
}): Promise<string | null> {
  const candidate = extractJsonCandidate(options.text);
  if (!candidate) return null;

  for (const attempt of normalizeJsonCandidate(candidate)) {
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      // Probamos la siguiente normalización antes de conservar el error original del SDK.
    }
  }

  return null;
}

export async function parseStructuredObjectFromText<T>(params: {
  text: string;
  schema: z.ZodType<T>;
}): Promise<T | null> {
  const repaired = await repairStructuredObjectText({ text: params.text });
  if (!repaired) return null;

  const parsed = JSON.parse(repaired) as unknown;
  const validation = await params.schema.safeParseAsync(parsed);
  return validation.success ? validation.data : null;
}

function buildFallbackObjectPrompt(prompt: string): string {
  return [
    prompt,
    "",
    "IMPORTANTE: la respuesta anterior no pudo parsearse como objeto estructurado.",
    "Devuelve ahora ÚNICAMENTE JSON válido, sin Markdown, sin comentarios, sin texto antes ni después.",
    "El JSON debe cumplir exactamente los campos solicitados en la tarea. Usa comillas dobles y",
    "no incluyas trailing commas.",
  ].join("\n");
}

async function fallbackTextObjectGeneration<T>(
  params: GenerateParams & { schema: z.ZodType<T> },
): Promise<ObjectGenerationResult<T> | null> {
  const result = await generateText({
    model: createOpenRouterModel(params.apiKey, params.modelId),
    system: params.system,
    prompt: buildFallbackObjectPrompt(params.prompt),
    maxRetries: params.maxRetries ?? MAX_RETRIES,
    abortSignal: buildAbortSignal(params.abortSignal, params.timeoutMs),
  });

  const object = await parseStructuredObjectFromText({ text: result.text, schema: params.schema });
  if (!object) return null;

  return {
    object,
    usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
  };
}

/**
 * Genera un objeto estructurado validado contra un esquema Zod (p. ej. el esquema del
 * outline o del informe de validación). El AI SDK fuerza al modelo a producir esa forma.
 */
export async function runObjectGeneration<T>(
  params: GenerateParams & { schema: z.ZodType<T> },
): Promise<ObjectGenerationResult<T>> {
  try {
    const result = await generateObject({
      model: createOpenRouterModel(params.apiKey, params.modelId),
      schema: params.schema,
      system: params.system,
      prompt: params.prompt,
      maxRetries: params.maxRetries ?? MAX_RETRIES,
      abortSignal: buildAbortSignal(params.abortSignal, params.timeoutMs),
      experimental_repairText: repairStructuredObjectText,
    });

    return {
      object: result.object,
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
    };
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;

    const repairedOriginal = error.text
      ? await parseStructuredObjectFromText({ text: error.text, schema: params.schema })
      : null;
    if (repairedOriginal) {
      return {
        object: repairedOriginal,
        usage: { inputTokens: error.usage?.inputTokens, outputTokens: error.usage?.outputTokens },
      };
    }

    const fallback = await fallbackTextObjectGeneration(params);
    if (fallback) return fallback;

    throw error;
  }
}

export interface ImageGenerationResult {
  /** Binario de la imagen en base64 (sin prefijo data:). */
  imageBase64: string;
  /** Tipo MIME real devuelto por el modelo (image/png, image/webp…). */
  mediaType: string;
  usage: { inputTokens?: number; outputTokens?: number };
}

/**
 * Genera una imagen con un modelo de imagen de OpenRouter (p. ej. Gemini Flash Image).
 * Estos modelos responden por la API de chat y el AI SDK expone las imágenes generadas en
 * `result.files`; se toma la primera. Lanza un error claro si el modelo no devolvió imagen
 * (modelo equivocado o rechazo del prompt).
 */
export async function runImageGeneration(params: GenerateParams): Promise<ImageGenerationResult> {
  const result = await generateText({
    model: createOpenRouterModel(params.apiKey, params.modelId),
    prompt: params.prompt,
    maxRetries: params.maxRetries ?? MAX_RETRIES,
    abortSignal: buildAbortSignal(params.abortSignal, params.timeoutMs),
  });

  const image = result.files?.find((file) => file.mediaType?.startsWith("image/"));
  if (!image) {
    throw new Error(
      `El modelo "${params.modelId}" no devolvió ninguna imagen (¿es un modelo de imagen?)`,
    );
  }

  return {
    imageBase64: image.base64,
    mediaType: image.mediaType,
    usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens },
  };
}
