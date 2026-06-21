import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Parámetros globales de la generación, configurables por el admin. La voz editorial y las
 * reglas SEO/GEO se diseñarán a fondo más adelante; de momento son texto libre que se
 * inyecta en los prompts. `sourceCount` y `maxFixIterations` acotan recursos y coste.
 */
export interface GenerationConfig {
  editorialVoice: string;
  seoRules: string;
  sourceCount: number;
  maxFixIterations: number;
}

// Valores por defecto razonables para que el sistema funcione antes de configurar nada.
const DEFAULTS: GenerationConfig = {
  editorialVoice: "",
  seoRules: "",
  sourceCount: 5,
  maxFixIterations: 2,
};

/** Convierte un ajuste de texto a entero dentro de un rango, cayendo al defecto si no es válido. */
function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export async function getGenerationConfig(): Promise<GenerationConfig> {
  const [editorialVoice, seoRules, sourceCount, maxFixIterations] = await Promise.all([
    getAppSetting(SETTING_KEYS.editorialVoice),
    getAppSetting(SETTING_KEYS.seoRules),
    getAppSetting(SETTING_KEYS.sourceCount),
    getAppSetting(SETTING_KEYS.maxFixIterations),
  ]);

  return {
    editorialVoice: editorialVoice ?? DEFAULTS.editorialVoice,
    seoRules: seoRules ?? DEFAULTS.seoRules,
    // Límites defensivos: descargar demasiadas webs o iterar sin fin dispara coste y latencia.
    sourceCount: parseBoundedInt(sourceCount, DEFAULTS.sourceCount, 1, 10),
    maxFixIterations: parseBoundedInt(maxFixIterations, DEFAULTS.maxFixIterations, 0, 5),
  };
}
