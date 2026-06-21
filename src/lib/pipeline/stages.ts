/**
 * Catálogo de etapas del pipeline: la ÚNICA fuente de verdad sobre qué etapas existen,
 * en qué orden y cómo se describen. Tanto la UI (landing, vista de progreso) como el
 * orquestador consumen esta lista, de modo que añadir o reordenar una etapa es un cambio
 * en un solo sitio y nada se desincroniza.
 *
 * Aquí solo vive la metadata (identidad y textos). La lógica de cada etapa está en
 * `steps/` y la configuración por defecto (modelo + prompt) en `default-config.ts`.
 */
export const STAGE_IDS = [
  "research",
  "extract",
  "blueprint",
  "draft",
  "validate",
  "fixer",
] as const;

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
    description:
      "Busca y descarga el contenido de varias webs, que serán la fuente de verdad. No usa IA.",
    usesAi: false,
  },
  {
    id: "extract",
    label: "Extracción",
    description:
      "Analiza las fuentes y extrae los hechos clave con su cita. Revisable por el usuario.",
    usesAi: true,
  },
  {
    id: "blueprint",
    label: "Estructura",
    description: "Diseña el esqueleto: titular de trabajo, ángulo, secciones y keyword objetivo.",
    usesAi: true,
  },
  {
    id: "draft",
    label: "Redacción",
    description:
      "Escribe el artículo con los hechos, la estructura, la voz editorial y las reglas SEO/GEO.",
    usesAi: true,
  },
  {
    id: "validate",
    label: "Validación",
    description:
      "Revisa fidelidad a las fuentes, tono humano, reglas editoriales y estándares SEO/GEO.",
    usesAi: true,
  },
  {
    id: "fixer",
    label: "Corrección",
    description: "Corrige lo que marca la validación, aplica formato y genera la meta SEO final.",
    usesAi: true,
  },
] as const;
