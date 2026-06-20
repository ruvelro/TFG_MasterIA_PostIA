// Resultado normalizado de una búsqueda, independiente del proveedor concreto. La etapa
// de research del pipeline solo conoce esta forma, no si vino de Tavily o de Google.
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Contrato común de un proveedor de búsqueda. Permite intercambiar Tavily por Google CSE
// (u otro futuro) sin tocar la etapa que los usa.
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export type SearchProviderId = "tavily" | "google";
