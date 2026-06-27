import { DEFAULT_PIPELINE_PARAMS } from "@/lib/pipeline/default-config";
import type { ScrubPattern } from "@/lib/pipeline/schemas";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";

import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Parámetros globales de la generación, configurables por el admin. La voz editorial y las
 * reglas SEO/GEO se inyectan en los prompts; `sourceCount` y los parámetros del bucle de
 * calidad (`maxFixIterations`, `maxHumanizeRetries`, `aiScoreThreshold`) acotan recursos y
 * coste; `scrubPatterns` controla la limpieza determinista final.
 */
export interface GenerationConfig {
  editorialVoice: string;
  seoRules: string;
  sourceCount: number;
  maxFixIterations: number;
  maxHumanizeRetries: number;
  aiScoreThreshold: number;
  scrubPatterns: ScrubPattern[];
}

// Valores por defecto razonables para que el sistema funcione antes de configurar nada.
const DEFAULTS: GenerationConfig = {
  editorialVoice: "",
  seoRules: "",
  sourceCount: 5,
  maxFixIterations: DEFAULT_PIPELINE_PARAMS.maxFixIterations,
  maxHumanizeRetries: DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries,
  aiScoreThreshold: DEFAULT_PIPELINE_PARAMS.aiScoreThreshold,
  scrubPatterns: [...DEFAULT_SCRUB_PATTERNS],
};

/** Convierte un ajuste de texto a entero dentro de un rango, cayendo al defecto si no es válido. */
function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/**
 * Serializa los patrones de limpieza para el textarea del admin: uno por línea. El
 * `replacement` se omite porque por defecto siempre es cadena vacía (eliminar la muletilla).
 */
export function serializeScrubPatterns(patterns: ScrubPattern[]): string {
  return patterns.map((p) => p.pattern).join("\n");
}

/** Parsea el textarea del admin (un patrón por línea) a la lista de patrones de limpieza. */
function parseScrubPatterns(raw: string | null): ScrubPattern[] {
  if (raw === null) return [...DEFAULTS.scrubPatterns];
  const patterns = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((pattern) => ({ pattern, replacement: "" }));
  // Un valor guardado vacío significa "sin limpieza", no "usa los de fábrica".
  return patterns;
}

export async function getGenerationConfig(): Promise<GenerationConfig> {
  const [
    editorialVoice,
    seoRules,
    sourceCount,
    maxFixIterations,
    maxHumanizeRetries,
    aiScoreThreshold,
    scrubPatterns,
  ] = await Promise.all([
    getAppSetting(SETTING_KEYS.editorialVoice),
    getAppSetting(SETTING_KEYS.seoRules),
    getAppSetting(SETTING_KEYS.sourceCount),
    getAppSetting(SETTING_KEYS.maxFixIterations),
    getAppSetting(SETTING_KEYS.maxHumanizeRetries),
    getAppSetting(SETTING_KEYS.aiScoreThreshold),
    getAppSetting(SETTING_KEYS.scrubPatterns),
  ]);

  return {
    editorialVoice: editorialVoice ?? DEFAULTS.editorialVoice,
    seoRules: seoRules ?? DEFAULTS.seoRules,
    // Límites defensivos: descargar demasiadas webs o iterar sin fin dispara coste y latencia.
    sourceCount: parseBoundedInt(sourceCount, DEFAULTS.sourceCount, 1, 10),
    maxFixIterations: parseBoundedInt(maxFixIterations, DEFAULTS.maxFixIterations, 0, 5),
    maxHumanizeRetries: parseBoundedInt(maxHumanizeRetries, DEFAULTS.maxHumanizeRetries, 0, 5),
    aiScoreThreshold: parseBoundedInt(aiScoreThreshold, DEFAULTS.aiScoreThreshold, 0, 100),
    scrubPatterns: parseScrubPatterns(scrubPatterns),
  };
}
