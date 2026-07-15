/**
 * Ventana temporal de una llamada completa del AI SDK, incluidos sus reintentos internos.
 * Los objetos extensos del fixer necesitan más margen que una respuesta corta del modelo.
 */
export const AI_TIMEOUT_DEFAULT_MS = 300_000;
export const AI_TIMEOUT_MIN_MS = 10_000;
export const AI_TIMEOUT_MAX_MS = 600_000;
