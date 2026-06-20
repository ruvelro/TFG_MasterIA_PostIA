// Claves estables con las que se identifican los secretos y ajustes en la base de datos.
// Centralizarlas evita typos y facilita ver de un vistazo qué se guarda.

export const SECRET_KEYS = {
  openRouter: "openrouter_api_key",
  tavily: "tavily_api_key",
  googleCse: "google_cse_api_key",
} as const;

export const SETTING_KEYS = {
  searchProvider: "search_provider",
  googleEngineId: "google_cse_engine_id",
} as const;
