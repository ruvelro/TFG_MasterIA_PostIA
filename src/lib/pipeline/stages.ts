/**
 * Catálogo de etapas del pipeline: la ÚNICA fuente de verdad sobre qué etapas existen,
 * en qué orden y cómo se describen. Tanto la UI (landing, vista de progreso) como el
 * orquestador (Fase 4) consumen esta lista, de modo que añadir o reordenar una etapa es
 * un cambio en un solo sitio y nada se desincroniza.
 *
 * Aquí solo vive la metadata (identidad y textos). La lógica de cada etapa se añade en la
 * Fase 4, asociándola a estos identificadores.
 */
export const STAGE_IDS = ["research", "outline", "draft", "validate", "humanize-seo"] as const;

export type StageId = (typeof STAGE_IDS)[number];

export interface PipelineStageMeta {
  readonly id: StageId;
  /** Nombre legible para mostrar en la interfaz. */
  readonly label: string;
  /** Explicación breve de qué hace la etapa, para la landing y la ayuda. */
  readonly description: string;
  /** Indica si la etapa invoca a un modelo de IA (research no lo hace). */
  readonly usesAi: boolean;
}

export const PIPELINE_STAGES: readonly PipelineStageMeta[] = [
  {
    id: "research",
    label: "Research",
    description: "Busca fuentes reales en la web mediante APIs de búsqueda. No usa IA.",
    usesAi: false,
  },
  {
    id: "outline",
    label: "Esquema",
    description: "Genera la estructura del artículo como datos validados.",
    usesAi: true,
  },
  {
    id: "draft",
    label: "Redacción",
    description: "Escribe el borrador a partir del esquema y las fuentes.",
    usesAi: true,
  },
  {
    id: "validate",
    label: "Validación",
    description: "Revisa coherencia y calidad contrastando con las fuentes.",
    usesAi: true,
  },
  {
    id: "humanize-seo",
    label: "Humanización + SEO",
    description: "Pule el tono y genera los metadatos SEO del artículo.",
    usesAi: true,
  },
] as const;
