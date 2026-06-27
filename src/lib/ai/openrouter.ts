import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Crea un modelo de lenguaje de OpenRouter a partir de una clave de API y un identificador
 * de modelo (p. ej. "google/gemini-2.5-flash"). Se crea por llamada porque la clave se
 * obtiene descifrada de la BD en cada generación, no se mantiene en memoria global.
 */
export function createOpenRouterModel(apiKey: string, modelId: string) {
  return createOpenRouter({ apiKey })(modelId);
}
