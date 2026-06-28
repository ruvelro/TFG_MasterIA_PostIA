/**
 * Precios de los modelos de OpenRouter para estimar el coste de una generación a partir de
 * los tokens que ya registra cada `GenerationStep`.
 *
 * El catálogo de precios se obtiene del endpoint PÚBLICO `GET /api/v1/models` (no requiere
 * clave) y se cachea en memoria con TTL: consultarlo en cada vista de traza sería un derroche.
 * Todo es best-effort: si la red falla, devolvemos un mapa vacío y la UI simplemente omite el
 * coste (nunca rompe la página por no poder estimar un importe informativo).
 */

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

/** Precio por token (USD) de un modelo: entrada (prompt) y salida (completion). */
export interface ModelPrice {
  prompt: number;
  completion: number;
}

export type PricingTable = Map<string, ModelPrice>;

let cache: { table: PricingTable; fetchedAt: number } | null = null;

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
}

/**
 * Normaliza un id de OpenRouter quitándole el sufijo de routing/variante (todo lo que sigue al
 * primer `:`, p. ej. `:free`, `:nitro`, `:floor`). El catálogo de precios indexa por el id base,
 * así que un modelo configurado como `vendor/model:free` debe poder casar con `vendor/model`.
 */
export function normalizeModelId(id: string): string {
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}

/**
 * Busca el precio de un modelo tolerando variantes de id: primero por coincidencia exacta y, si
 * falla, por id normalizado. Devuelve `null` si el modelo no está en el catálogo. Se expone para
 * que el consumidor pueda distinguir "sin precio" (modelo desconocido) de "coste cero".
 */
export function findModelPrice(pricing: PricingTable, model: string): ModelPrice | null {
  return pricing.get(model) ?? pricing.get(normalizeModelId(model)) ?? null;
}

/**
 * Devuelve el catálogo de precios (cacheado). Mapa vacío si la consulta falla o en e2e (donde
 * no debe haber llamadas externas). El cacheo solo ocurre cuando la consulta tiene éxito, para
 * poder reintentar tras un fallo transitorio.
 */
export async function getModelPricing(): Promise<PricingTable> {
  if (process.env.E2E === "true") return new Map();

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.table;

  try {
    const response = await fetch(MODELS_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return new Map();

    const body = (await response.json()) as { data?: OpenRouterModel[] };
    const table: PricingTable = new Map();
    for (const model of body.data ?? []) {
      const prompt = Number(model.pricing?.prompt);
      const completion = Number(model.pricing?.completion);
      // OpenRouter da el precio por token como string; descartamos los no numéricos.
      if (Number.isFinite(prompt) && Number.isFinite(completion)) {
        const price = { prompt, completion };
        table.set(model.id, price);
        // Indexamos también por id base para tolerar variantes (`:free`, etc.) al consultar.
        // El id exacto tiene prioridad: solo añadimos el normalizado si no colisiona.
        const base = normalizeModelId(model.id);
        if (base !== model.id && !table.has(base)) {
          table.set(base, price);
        }
      }
    }
    cache = { table, fetchedAt: now };
    return table;
  } catch {
    return new Map();
  }
}

/**
 * Estima el coste (USD) de una etapa a partir de su modelo y tokens. Devuelve `null` si no hay
 * modelo, no hay tokens o el modelo no está en el catálogo: la UI lo trata como "no disponible".
 */
export function estimateCostUsd(
  pricing: PricingTable,
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model) return null;
  const price = findModelPrice(pricing, model);
  if (!price) return null;
  return (inputTokens ?? 0) * price.prompt + (outputTokens ?? 0) * price.completion;
}

/** Para tests: limpia la caché de precios entre casos. */
export function resetPricingCache(): void {
  cache = null;
}
