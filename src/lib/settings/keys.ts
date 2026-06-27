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
  // Configuración de generación.
  sourceCount: "research_source_count",
  maxFixIterations: "max_fix_iterations",
  // Parámetros del bucle de calidad y de la limpieza final.
  maxHumanizeRetries: "max_humanize_retries",
  aiScoreThreshold: "ai_score_threshold",
  scrubPatterns: "scrub_patterns",
  // Estilo editorial estructurado (JSON) y modelo del analizador de estilo.
  styleProfile: "editorial_style_profile",
  styleAnalyzerModel: "style_analyzer_model",
  // Claves heredadas (perfil plano): se usan como semilla del perfil estructurado.
  legacyEditorialVoice: "editorial_voice",
  legacySeoRules: "seo_rules",
} as const;
