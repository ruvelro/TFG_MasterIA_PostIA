import { detectPromptInjection } from "@/lib/pipeline/injection-heuristics";
import { QueryExpansionSchema } from "@/lib/pipeline/schemas";
import {
  resolveResearchFreshnessDays,
  selectHighQualitySources,
} from "@/lib/pipeline/source-quality";
import type {
  PipelineContext,
  PipelineDeps,
  PipelineSource,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";
import type { SearchResult } from "@/lib/search";

/**
 * Etapa research (sin IA en su núcleo): busca fuentes y DESCARGA su contenido, que será la
 * fuente de verdad del artículo. La calidad de todo el pipeline está acotada por lo que entra
 * aquí, así que la búsqueda se refuerza en tres frentes:
 *
 * 1. Expansión de consultas (micro-llamada de IA opcional, modelo barato): 2-3 consultas
 *    complementarias al tema literal para diversificar resultados. Si falla, se degrada al
 *    tema tal cual (la expansión nunca tumba la generación).
 * 2. Reunión de un pool de candidatos antes de cortar, con deduplicación y límite por dominio.
 * 3. Frescura explícita del tipo o automática cuando el tema menciona el año actual.
 * 4. Selección posterior a la descarga por autoridad, actualidad y contenido útil.
 *
 * Si la descarga de una fuente falla, no abortamos toda la generación: caemos al extracto de
 * la búsqueda para esa fuente concreta (degradación elegante).
 */

/** Máximo de fuentes de un mismo dominio: diversifica la base factual del artículo. */
const MAX_SOURCES_PER_DOMAIN = 2;

const QUERY_EXPANSION_PROMPT = [
  "Eres un documentalista. Genera entre 2 y 3 consultas COMPLEMENTARIAS al tema, en su idioma.",
  "La primera debe buscar una fuente primaria u oficial con los hechos más recientes. La segunda",
  "debe buscar cobertura periodística actual e independiente que contraste esos hechos. Usa la",
  "tercera, si hace falta, para el contexto técnico preciso. Si el tema trata un suceso ya ocurrido,",
  "busca resultados o crónicas posteriores: evita previas, predicciones y planes publicados antes.",
  "No repitas el tema literal ni propongas búsquedas en redes sociales.",
  "Fecha actual: {{currentDate}}.",
  "",
  "Tema: {{topic}}",
].join("\n");

/** Clave de dedupe: URL sin hash ni barra final, con host en minúsculas. */
function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return `${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return rawUrl;
  }
}

/** Dominio registrable aproximado para el límite por dominio (sin "www."). */
function domainOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

/**
 * Fusiona los resultados de varias consultas: dedupe por URL normalizada, máximo
 * `MAX_SOURCES_PER_DOMAIN` por dominio y corte en `limit`. El orden de llegada manda.
 */
export function mergeSearchResults(resultLists: SearchResult[][], limit: number): SearchResult[] {
  const seenUrls = new Set<string>();
  const perDomain = new Map<string, number>();
  const merged: SearchResult[] = [];

  for (const results of resultLists) {
    for (const result of results) {
      if (merged.length >= limit) return merged;
      if (!result.url) continue;
      const urlKey = normalizeUrl(result.url);
      if (seenUrls.has(urlKey)) continue;
      const domain = domainOf(result.url);
      const domainCount = perDomain.get(domain) ?? 0;
      if (domainCount >= MAX_SOURCES_PER_DOMAIN) continue;

      seenUrls.add(urlKey);
      perDomain.set(domain, domainCount + 1);
      merged.push(result);
    }
  }
  return merged;
}

export interface ResearchResult {
  sources: PipelineSource[];
  /** Modelo y tokens de la expansión de consultas (si se ejecutó), para la traza de coste. */
  model?: string;
  usage?: TokenUsage;
}

export async function runResearch(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<ResearchResult> {
  // 1. Expansión de consultas (opcional). Nunca bloquea: si el modelo falla, seguimos solo
  // con el tema literal.
  let expandedQueries: string[] = [];
  let model: string | undefined;
  let usage: TokenUsage | undefined;
  if (cfg.queryExpansionModel) {
    try {
      const result = await deps.runObject({
        modelId: cfg.queryExpansionModel,
        prompt: QUERY_EXPANSION_PROMPT.replace("{{topic}}", ctx.topic).replace(
          "{{currentDate}}",
          new Date().toISOString().slice(0, 10),
        ),
        schema: QueryExpansionSchema,
      });
      expandedQueries = result.object.queries;
      model = cfg.queryExpansionModel;
      usage = result.usage;
    } catch {
      // Degradación: investigación clásica con el tema literal.
    }
  }
  // Las consultas complementarias se diseñan para localizar primero fuentes oficiales y actuales;
  // el tema literal queda como red de seguridad de relevancia.
  const queries = [...expandedQueries, ctx.topic];

  // 2. Búsqueda de todas las consultas en paralelo. Una consulta fallida no tumba las demás;
  // solo si TODAS fallan se propaga el primer error (no habría nada que investigar).
  const freshnessDays = resolveResearchFreshnessDays(ctx.topic, ctx.newsType?.freshnessDays ?? 0);
  const settled = await Promise.allSettled(
    queries.map((query) =>
      deps.search(query, cfg.sourceCount, freshnessDays > 0 ? { freshnessDays } : undefined),
    ),
  );
  const resultLists = settled
    .filter((s): s is PromiseFulfilledResult<SearchResult[]> => s.status === "fulfilled")
    .map((s) => s.value);
  if (resultLists.length === 0) {
    const firstError = settled.find(
      (s): s is PromiseRejectedResult => s.status === "rejected",
    )?.reason;
    throw firstError instanceof Error ? firstError : new Error("La búsqueda de fuentes falló");
  }

  // 3. Reunimos candidatos de todas las consultas. Cortar aquí a `sourceCount` haría que una sola
  // consulta expulsase las fuentes oficiales encontradas por las demás.
  const candidateLimit = cfg.sourceCount * resultLists.length;
  const results = mergeSearchResults(resultLists, candidateLimit);

  const candidates = await Promise.all(
    results.map(async (result): Promise<PipelineSource> => {
      try {
        const content = await deps.fetchContent(result.url);
        // Anti-inyección: si el cuerpo trae órdenes dirigidas al modelo, no dejamos que
        // llegue a los prompts; degradamos al extracto de búsqueda y marcamos la fuente
        // como sospechosa para que el prompt de extracción la trate con cautela.
        if (detectPromptInjection(content)) {
          return { ...result, content: result.snippet, suspicious: true };
        }
        return { ...result, content };
      } catch {
        return { ...result, content: result.snippet };
      }
    }),
  );

  // 4. La selección se hace con el cuerpo ya disponible: redes sociales quedan fuera, los snippets
  // mínimos no desplazan documentos completos y las referencias comunitarias solo son fallback.
  const sources = selectHighQualitySources(candidates, cfg.sourceCount, ctx.topic);
  if (sources.length === 0) {
    throw new Error("No se encontraron fuentes documentales útiles para investigar el tema");
  }

  return { sources, model, usage };
}
