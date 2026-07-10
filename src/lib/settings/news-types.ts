import { NewsTypeCatalogSchema, type NewsType } from "@/lib/pipeline/schemas";

import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Catálogo de tipos de noticia: presets editables que adaptan el pipeline a distintos formatos.
 * Se guarda como JSON en `AppSetting`. El primer tipo es el predeterminado cuando una generación
 * no especifica ninguno.
 */

/** Catálogo de fábrica. "estandar" replica el comportamiento completo (todas las etapas). */
export const DEFAULT_NEWS_TYPES: NewsType[] = [
  {
    id: "estandar",
    label: "Estándar",
    description: "Artículo completo con todas las fases de calidad activas.",
    enableHumanize: true,
    enableFactualReview: true,
    enableQualityReview: true,
    sourceStrict: false,
    structureInstruction: "",
    targetWordCount: 0,
    voiceBrand: "",
    voiceHouseRules: "",
    voiceExamples: [],
    enableFeatureImage: false,
    freshnessDays: 0,
  },
  {
    id: "nota-breve",
    label: "Nota breve",
    description: "Pieza corta y directa; omite la auditoría de calidad para agilizar.",
    enableHumanize: true,
    enableFactualReview: true,
    enableQualityReview: false,
    sourceStrict: true,
    structureInstruction:
      "Redacta una nota informativa breve: entradilla con lo esencial y 2-3 párrafos de desarrollo. Sin secciones largas.",
    targetWordCount: 350,
    voiceBrand: "",
    voiceHouseRules: "",
    voiceExamples: [],
    enableFeatureImage: false,
    // Las notas breves son piezas de actualidad: fuentes de los últimos 30 días.
    freshnessDays: 30,
  },
  {
    id: "analisis",
    label: "Análisis en profundidad",
    description: "Pieza extensa y argumentada con todas las fases de calidad.",
    enableHumanize: true,
    enableFactualReview: true,
    enableQualityReview: true,
    sourceStrict: false,
    structureInstruction:
      "Desarrolla un análisis extenso: contexto, varias secciones temáticas con subtítulos y un cierre con conclusiones.",
    targetWordCount: 1200,
    voiceBrand: "",
    voiceHouseRules: "",
    voiceExamples: [],
    enableFeatureImage: false,
    freshnessDays: 0,
  },
];

/** Devuelve el catálogo guardado, o el de fábrica si no hay nada/el JSON es inválido. */
export async function getNewsTypes(): Promise<NewsType[]> {
  const raw = await getAppSetting(SETTING_KEYS.newsTypes);
  if (raw) {
    try {
      const parsed = NewsTypeCatalogSchema.safeParse(JSON.parse(raw));
      // Un catálogo vacío guardado no tiene sentido: caemos al de fábrica.
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // JSON corrupto: catálogo de fábrica en lugar de romper.
    }
  }
  return DEFAULT_NEWS_TYPES;
}

/** Serializa el catálogo para persistirlo como JSON. */
export function serializeNewsTypes(types: NewsType[]): string {
  return JSON.stringify(types);
}

/**
 * Resuelve el tipo seleccionado por id. Si el id no existe (o no se indica), devuelve el primer
 * tipo del catálogo como predeterminado, de modo que siempre hay un tipo válido.
 */
export async function resolveNewsType(id: string | undefined): Promise<NewsType> {
  const types = await getNewsTypes();
  return types.find((t) => t.id === id) ?? types[0];
}
