import { GoogleCseProvider } from "@/lib/search/google-cse";
import { TavilyProvider } from "@/lib/search/tavily";
import type { SearchProvider, SearchProviderId } from "@/lib/search/types";

export type {
  SearchOptions,
  SearchProvider,
  SearchResult,
  SearchProviderId,
} from "@/lib/search/types";

/** Configuración resuelta (claves ya descifradas) necesaria para crear un proveedor. */
export interface SearchConfig {
  provider: SearchProviderId;
  tavilyApiKey?: string;
  googleApiKey?: string;
  googleEngineId?: string;
}

/**
 * Factoría: crea el proveedor de búsqueda activo según la configuración. Lanza un error
 * claro si faltan las credenciales del proveedor elegido, en lugar de fallar más tarde con
 * una respuesta HTTP confusa.
 */
export function createSearchProvider(config: SearchConfig): SearchProvider {
  switch (config.provider) {
    case "tavily": {
      if (!config.tavilyApiKey) {
        throw new Error(
          "Falta la clave de API de Tavily. Configúrala en el panel de administración.",
        );
      }
      return new TavilyProvider(config.tavilyApiKey);
    }
    case "google": {
      if (!config.googleApiKey || !config.googleEngineId) {
        throw new Error(
          "Faltan la clave de API y/o el id del motor de Google CSE. Configúralos en el panel.",
        );
      }
      return new GoogleCseProvider(config.googleApiKey, config.googleEngineId);
    }
    default: {
      // Exhaustividad: si se añade un proveedor nuevo y se olvida aquí, TypeScript avisa.
      const exhaustive: never = config.provider;
      throw new Error(`Proveedor de búsqueda desconocido: ${String(exhaustive)}`);
    }
  }
}
