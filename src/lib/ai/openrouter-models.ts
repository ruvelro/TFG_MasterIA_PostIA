/**
 * Catálogo de modelos disponibles en OpenRouter.
 *
 * El endpoint público `/api/v1/models` no requiere clave, pero SÍ debe consultarse desde el
 * servidor: la CSP del navegador bloquea peticiones a hosts externos, así que la UI de admin
 * pide la lista a nuestra propia ruta interna y esta función es la que sale a OpenRouter.
 *
 * Se cachea en memoria del proceso con un TTL corto porque el catálogo cambia poco y no tiene
 * sentido salir a la red en cada apertura del panel. Si la petición falla, se devuelve la
 * última lista cacheada (aunque esté caducada) para no romper la UI por un fallo transitorio.
 */

const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const FETCH_TIMEOUT_MS = 10_000;

/** Modelo tal y como lo consume la UI: lo mínimo para elegir y filtrar. */
export interface OpenRouterModel {
  /** Identificador que se envía a la API, p. ej. "google/gemini-2.5-flash". */
  id: string;
  /** Nombre legible, p. ej. "Google: Gemini 2.5 Flash". */
  name: string;
}

interface CacheEntry {
  models: OpenRouterModel[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

/** Forma mínima de cada elemento de la respuesta de OpenRouter que nos interesa. */
interface RawModel {
  id?: unknown;
  name?: unknown;
}

function normalize(raw: unknown): OpenRouterModel[] {
  const data = (raw as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const models: OpenRouterModel[] = [];
  for (const item of data as RawModel[]) {
    if (typeof item?.id !== "string" || item.id.length === 0) continue;
    const name = typeof item.name === "string" && item.name.length > 0 ? item.name : item.id;
    models.push({ id: item.id, name });
  }
  // Orden alfabético por id para una lista estable y predecible.
  models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

/**
 * Devuelve el catálogo de modelos de OpenRouter, sirviéndolo de caché mientras siga fresco.
 * Nunca lanza por un fallo de red: en ese caso devuelve la caché previa o una lista vacía.
 */
export async function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.models;
  }

  try {
    const response = await fetch(MODELS_ENDPOINT, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OpenRouter respondió ${response.status}`);
    const models = normalize(await response.json());
    // Solo se actualiza la caché si la lista no viene vacía, para no pisar datos buenos.
    if (models.length > 0) cache = { models, fetchedAt: now };
    return cache?.models ?? models;
  } catch {
    // Ante un fallo transitorio, servir la última lista conocida (aunque esté caducada).
    return cache?.models ?? [];
  }
}
