import { DEFAULT_PIPELINE_PARAMS } from "@/lib/pipeline/default-config";
import {
  StyleProfileSchema,
  ValidatorConfigSchema,
  type ScrubPattern,
  type StyleProfile,
  type ValidatorConfig,
} from "@/lib/pipeline/schemas";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";

import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Parámetros globales de la generación, configurables por el admin. El `styleProfile` define
 * la identidad editorial (voz, reglas, autoridad, SEO/GEO, palabras prohibidas y ejemplos);
 * `sourceCount` y los parámetros del bucle de calidad acotan recursos y coste; `scrubPatterns`
 * controla la limpieza determinista final.
 */
export interface GenerationConfig {
  styleProfile: StyleProfile;
  sourceCount: number;
  maxFixIterations: number;
  maxHumanizeRetries: number;
  aiScoreThreshold: number;
  scrubPatterns: ScrubPattern[];
  validatorConfig: ValidatorConfig;
  /** Reintentos por llamada de IA ante errores transitorios de OpenRouter (429/5xx). */
  aiMaxRetries: number;
  /** Timeout por llamada de IA en ms; evita que una etapa colgada bloquee la generación. */
  aiTimeoutMs: number;
}

/** Perfil de estilo vacío: punto de partida cuando no hay nada configurado. */
export const EMPTY_STYLE_PROFILE: StyleProfile = {
  brandVoice: "",
  houseRules: "",
  eeatAuthor: "",
  seoRules: "",
  geoRules: "",
  languageRegion: "",
  forbiddenWords: [],
  fewShotExamples: [],
};

/** Modelo por defecto del analizador de estilo: capaz y de contexto amplio, pero barato. */
export const DEFAULT_STYLE_ANALYZER_MODEL = "google/gemini-2.5-flash";

const SOURCE_COUNT_DEFAULT = 5;

/** Convierte un ajuste de texto a entero dentro de un rango, cayendo al defecto si no es válido. */
function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/**
 * Resuelve el perfil de estilo. Si aún no existe el perfil estructurado, lo SIEMBRA con las
 * claves heredadas del perfil plano (`editorial_voice` → voz de marca, `seo_rules` → reglas
 * SEO), de modo que nada de lo configurado antes se pierde al migrar.
 */
export async function getStyleProfile(): Promise<StyleProfile> {
  const [raw, legacyVoice, legacySeo] = await Promise.all([
    getAppSetting(SETTING_KEYS.styleProfile),
    getAppSetting(SETTING_KEYS.legacyEditorialVoice),
    getAppSetting(SETTING_KEYS.legacySeoRules),
  ]);

  if (raw) {
    try {
      const parsed = StyleProfileSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON corrupto: caemos a la semilla heredada / perfil vacío en lugar de romper.
    }
  }

  return {
    ...EMPTY_STYLE_PROFILE,
    brandVoice: legacyVoice ?? "",
    seoRules: legacySeo ?? "",
  };
}

/** Persiste el perfil de estilo (validado por el llamador) como JSON. */
export function serializeStyleProfile(profile: StyleProfile): string {
  return JSON.stringify(profile);
}

/** Modelo configurado para el analizador de estilo, o el de fábrica. */
export async function getStyleAnalyzerModel(): Promise<string> {
  const model = await getAppSetting(SETTING_KEYS.styleAnalyzerModel);
  return model?.trim() || DEFAULT_STYLE_ANALYZER_MODEL;
}

/** Serializa la configuración del validador editorial para persistirla como JSON. */
export function serializeValidatorConfig(config: ValidatorConfig): string {
  return JSON.stringify(config);
}

/** Configuración del validador editorial determinista, o la de fábrica si no hay/es inválida. */
export async function getValidatorConfig(): Promise<ValidatorConfig> {
  const raw = await getAppSetting(SETTING_KEYS.validatorConfig);
  if (raw) {
    try {
      const parsed = ValidatorConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON corrupto: caemos a la configuración de fábrica en lugar de romper.
    }
  }
  return DEFAULT_VALIDATOR_CONFIG;
}

/** Serializa los patrones de limpieza para el textarea del admin: uno por línea. */
export function serializeScrubPatterns(patterns: ScrubPattern[]): string {
  return patterns.map((p) => p.pattern).join("\n");
}

/** Parsea el textarea del admin (un patrón por línea) a la lista de patrones de limpieza. */
function parseScrubPatterns(raw: string | null): ScrubPattern[] {
  if (raw === null) return [...DEFAULT_SCRUB_PATTERNS];
  // Un valor guardado vacío significa "sin limpieza", no "usa los de fábrica".
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((pattern) => ({ pattern, replacement: "" }));
}

export async function getGenerationConfig(): Promise<GenerationConfig> {
  const [
    styleProfile,
    validatorConfig,
    sourceCount,
    maxFixIterations,
    maxHumanizeRetries,
    aiScoreThreshold,
    scrubPatterns,
    aiMaxRetries,
    aiTimeoutMs,
  ] = await Promise.all([
    getStyleProfile(),
    getValidatorConfig(),
    getAppSetting(SETTING_KEYS.sourceCount),
    getAppSetting(SETTING_KEYS.maxFixIterations),
    getAppSetting(SETTING_KEYS.maxHumanizeRetries),
    getAppSetting(SETTING_KEYS.aiScoreThreshold),
    getAppSetting(SETTING_KEYS.scrubPatterns),
    getAppSetting(SETTING_KEYS.aiMaxRetries),
    getAppSetting(SETTING_KEYS.aiTimeoutMs),
  ]);

  return {
    styleProfile,
    validatorConfig,
    // Límites defensivos: descargar demasiadas webs o iterar sin fin dispara coste y latencia.
    sourceCount: parseBoundedInt(sourceCount, SOURCE_COUNT_DEFAULT, 1, 10),
    maxFixIterations: parseBoundedInt(
      maxFixIterations,
      DEFAULT_PIPELINE_PARAMS.maxFixIterations,
      0,
      5,
    ),
    maxHumanizeRetries: parseBoundedInt(
      maxHumanizeRetries,
      DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries,
      0,
      5,
    ),
    aiScoreThreshold: parseBoundedInt(
      aiScoreThreshold,
      DEFAULT_PIPELINE_PARAMS.aiScoreThreshold,
      0,
      100,
    ),
    scrubPatterns: parseScrubPatterns(scrubPatterns),
    // Resiliencia de IA: pocos reintentos (más solo multiplican coste y latencia) y un timeout
    // acotado entre 10 s y 5 min (por debajo no da margen ni a modelos rápidos; por encima
    // mantendría una conexión colgada demasiado tiempo).
    aiMaxRetries: parseBoundedInt(aiMaxRetries, DEFAULT_PIPELINE_PARAMS.aiMaxRetries, 0, 5),
    aiTimeoutMs: parseBoundedInt(aiTimeoutMs, DEFAULT_PIPELINE_PARAMS.aiTimeoutMs, 10_000, 300_000),
  };
}
