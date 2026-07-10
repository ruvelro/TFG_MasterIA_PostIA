// Resultado normalizado de una búsqueda, independiente del proveedor concreto. La etapa
// de research del pipeline solo conoce esta forma, no si vino de Tavily o de Google.
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Opciones comunes de búsqueda que cada proveedor traduce a sus parámetros nativos.
export interface SearchOptions {
  /**
   * Frescura: limitar los resultados a los últimos N días (0 o ausente = sin filtro).
   * La usa la etapa research cuando el tipo de noticia es de actualidad.
   */
  freshnessDays?: number;
}

// Contrato común de un proveedor de búsqueda. Permite intercambiar Tavily por Google CSE
// (u otro futuro) sin tocar la etapa que los usa.
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number, options?: SearchOptions): Promise<SearchResult[]>;
}

export type SearchProviderId = "tavily" | "google";
