import type { SearchProvider, SearchResult } from "@/lib/search/types";

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

// Forma mínima de la respuesta de Google Custom Search que nos interesa.
interface GoogleCseResponse {
  items?: Array<{ title?: string; link?: string; snippet?: string }>;
}

/**
 * Proveedor de búsqueda basado en Google Custom Search (CSE). Necesita una clave de API y
 * el id del motor de búsqueda (cx). Ambos se inyectan por constructor.
 */
export class GoogleCseProvider implements SearchProvider {
  readonly name = "google";

  constructor(
    private readonly apiKey: string,
    private readonly engineId: string,
  ) {}

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const url = new URL(GOOGLE_CSE_ENDPOINT);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("cx", this.engineId);
    url.searchParams.set("q", query);
    // Google CSE limita `num` a 1..10 por petición.
    url.searchParams.set("num", String(Math.min(Math.max(limit, 1), 10)));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google CSE respondió ${response.status}`);
    }

    const data = (await response.json()) as GoogleCseResponse;
    return (data.items ?? []).map((item) => ({
      title: item.title ?? "",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
    }));
  }
}
