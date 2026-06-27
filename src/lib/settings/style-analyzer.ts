import type { z } from "zod";

import { StyleAnalysisResultSchema, type StyleAnalysisResult } from "@/lib/pipeline/schemas";

/**
 * Analizador de estilo editorial: descarga un conjunto de URLs (de 1 a cientos) y, mediante
 * IA, infiere el perfil de estilo de la publicación. Escala a muchas URLs con una estrategia
 * MAP-REDUCE: se analiza el contenido por lotes (map) y luego se consolidan las notas en un
 * único perfil (reduce). Así no se desborda la ventana de contexto del modelo.
 *
 * Las dependencias (descarga + IA) se inyectan para poder testear la lógica sin red ni claves.
 */

/** Tope de URLs por análisis: cota de coste/latencia razonable para una acción de admin. */
export const MAX_ANALYZER_URLS = 200;

const FETCH_CONCURRENCY = 6;
const PER_ARTICLE_CHARS = 3_500; // recorta cada artículo para acotar tokens por lote
const BATCH_CHAR_BUDGET = 40_000; // presupuesto de caracteres por lote del paso "map"

export interface AnalyzerDeps {
  fetchContent: (url: string) => Promise<string>;
  runText: (params: { modelId: string; prompt: string }) => Promise<{ text: string }>;
  runObject: <T>(params: {
    modelId: string;
    prompt: string;
    schema: z.ZodType<T>;
  }) => Promise<{ object: T }>;
}

export type AnalyzerProgress =
  | { phase: "fetch"; done: number; total: number }
  | { phase: "analyze"; done: number; total: number }
  | { phase: "consolidate" };

/** Ejecuta `task` sobre cada elemento con un límite de concurrencia (pool de trabajadores). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Agrupa los textos en lotes cuyo tamaño total no supera el presupuesto de caracteres. */
function batchByCharBudget(texts: string[], budget: number): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of texts) {
    // Si el lote ya tiene algo y añadir este texto lo desborda, cierra el lote.
    if (current.length > 0 && size + text.length > budget) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const MAP_PROMPT_HEADER = [
  "Eres un analista de estilo editorial. A partir de los siguientes artículos de una misma",
  "publicación, redacta NOTAS CONCISAS sobre su estilo: tono y voz, registro, longitud y ritmo",
  "de las frases, estructura de los textos, vocabulario característico, y muletillas o palabras",
  "que se repiten en exceso (candidatas a evitar). No copies los artículos; resume su estilo.",
  "",
  "Artículos:",
].join("\n");

const REDUCE_PROMPT_HEADER = [
  "Eres un director editorial. A partir de las NOTAS DE ESTILO de varios artículos de una misma",
  "publicación, consolida un perfil de estilo coherente con estos campos:",
  "- brandVoice: la voz y personalidad de la marca.",
  "- houseRules: reglas de casa concretas (qué hacer y qué evitar al redactar).",
  "- eeatAuthor: señales de autoridad/experiencia si se infieren; si no, cadena vacía.",
  "- languageRegion: idioma, variedad y registro detectados.",
  "- forbiddenWords: lista de muletillas o palabras a evitar (las que se repiten o suenan a IA).",
  "- fewShotExamples: 2-3 párrafos BREVES, escritos por ti, que EJEMPLIFIQUEN el estilo detectado",
  "  (no copies texto literal de los artículos).",
  "",
  "Notas de estilo:",
].join("\n");

/**
 * Analiza el estilo editorial de un conjunto de URLs y devuelve el perfil inferido (sin las
 * reglas SEO/GEO, que son política editorial y las completa el admin a mano).
 */
export async function analyzeEditorialStyle(params: {
  urls: string[];
  model: string;
  deps: AnalyzerDeps;
  onProgress?: (progress: AnalyzerProgress) => void;
}): Promise<StyleAnalysisResult> {
  const { model, deps, onProgress } = params;
  const urls = [...new Set(params.urls)].slice(0, MAX_ANALYZER_URLS);
  if (urls.length === 0) throw new Error("No se proporcionaron URLs válidas");

  // 1. Descarga tolerante a fallos: una URL caída no aborta el análisis.
  let fetched = 0;
  const downloaded = await mapWithConcurrency(urls, FETCH_CONCURRENCY, async (url) => {
    try {
      const text = await deps.fetchContent(url);
      return text.trim().slice(0, PER_ARTICLE_CHARS);
    } catch {
      return "";
    } finally {
      fetched += 1;
      onProgress?.({ phase: "fetch", done: fetched, total: urls.length });
    }
  });

  const contents = downloaded.filter((text) => text.length > 0);
  if (contents.length === 0) {
    throw new Error("No se pudo extraer contenido de ninguna de las URLs proporcionadas");
  }

  // 2. MAP: resume el estilo de cada lote por separado.
  const batches = batchByCharBudget(contents, BATCH_CHAR_BUDGET);
  let analyzed = 0;
  const notes = await mapWithConcurrency(batches, 3, async (batch) => {
    const prompt = `${MAP_PROMPT_HEADER}\n${batch.map((t, i) => `[${i + 1}]\n${t}`).join("\n\n")}`;
    const { text } = await deps.runText({ modelId: model, prompt });
    analyzed += 1;
    onProgress?.({ phase: "analyze", done: analyzed, total: batches.length });
    return text;
  });

  // 3. REDUCE: consolida todas las notas en un único perfil estructurado.
  onProgress?.({ phase: "consolidate" });
  const reducePrompt = `${REDUCE_PROMPT_HEADER}\n${notes.map((n, i) => `--- Notas ${i + 1} ---\n${n}`).join("\n\n")}`;
  const { object } = await deps.runObject({
    modelId: model,
    prompt: reducePrompt,
    schema: StyleAnalysisResultSchema,
  });
  return object;
}
