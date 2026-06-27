import { LengthPresetCatalogSchema, type LengthPreset } from "@/lib/pipeline/schemas";

import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Catálogo de presets de longitud: rangos de palabras editables que el usuario elige al generar.
 * Se guarda como JSON en `AppSetting`. El primero es el predeterminado.
 */

/** Catálogo de fábrica. */
export const DEFAULT_LENGTH_PRESETS: LengthPreset[] = [
  { id: "breve", label: "Breve", minWords: 300, maxWords: 500 },
  { id: "estandar", label: "Estándar", minWords: 700, maxWords: 1000 },
  { id: "extenso", label: "Extenso", minWords: 1200, maxWords: 1800 },
];

/** Devuelve el catálogo guardado, o el de fábrica si no hay nada/el JSON es inválido o vacío. */
export async function getLengthPresets(): Promise<LengthPreset[]> {
  const raw = await getAppSetting(SETTING_KEYS.lengthPresets);
  if (raw) {
    try {
      const parsed = LengthPresetCatalogSchema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // JSON corrupto: catálogo de fábrica en lugar de romper.
    }
  }
  return DEFAULT_LENGTH_PRESETS;
}

/** Serializa el catálogo para persistirlo como JSON. */
export function serializeLengthPresets(presets: LengthPreset[]): string {
  return JSON.stringify(presets);
}

/**
 * Resuelve el preset seleccionado por id. Si el id no existe, devuelve `undefined` para que la
 * longitud la gobierne, si acaso, el `targetWordCount` del tipo de noticia.
 */
export async function resolveLengthPreset(
  id: string | undefined,
): Promise<LengthPreset | undefined> {
  if (!id) return undefined;
  const presets = await getLengthPresets();
  return presets.find((p) => p.id === id);
}
