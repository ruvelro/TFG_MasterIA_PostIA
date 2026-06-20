import type { SearchProvider, SearchResult } from "@/lib/search/types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

// Forma mínima de la respuesta de Tavily que nos interesa (el resto se ignora).
interface TavilyResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

/**
 * Proveedor de búsqueda basado en Tavily (https://tavily.com). Recibe la clave por
 * constructor para no acoplarse a cómo se almacena (la inyecta la factoría desde la BD).
 */
export class TavilyProvider implements SearchProvider {
  readonly name = "tavily";

  constructor(private readonly apiKey: string) {}

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, max_results: limit }),
    });

    if (!response.ok) {
      throw new Error(`Tavily respondió ${response.status}`);
    }

    const data = (await response.json()) as TavilyResponse;
    return (data.results ?? []).map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      snippet: item.content ?? "",
    }));
  }
}
