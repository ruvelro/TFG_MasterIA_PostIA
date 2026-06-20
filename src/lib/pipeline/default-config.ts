import type { StageId } from "@/lib/pipeline/stages";

/**
 * Configuración por defecto de las etapas que usan IA.
 *
 * `research` no aparece aquí porque no usa modelos (usa APIs de búsqueda). Estos valores
 * son los predeterminados de fábrica: el administrador puede sobreescribir modelo y prompt
 * desde el panel, y cada generación puede aún hacer un override puntual. Los prompts son
 * plantillas con marcadores `{{...}}` que el pipeline rellena con el contexto acumulado.
 */
export interface StepConfig {
  /** Identificador de modelo de OpenRouter, p. ej. "google/gemini-2.5-flash". */
  model: string;
  /** Plantilla de prompt que se envía al modelo. */
  prompt: string;
}

/** Etapas que usan IA, en orden. La validación de la app se apoya en este conjunto. */
export const AI_STAGE_IDS = ["outline", "draft", "validate", "humanize-seo"] as const;

export type AiStageId = (typeof AI_STAGE_IDS)[number];

export function isAiStage(stageId: StageId): stageId is AiStageId {
  return (AI_STAGE_IDS as readonly string[]).includes(stageId);
}

export const DEFAULT_STEP_CONFIG: Record<AiStageId, StepConfig> = {
  outline: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un editor experto en contenidos de blog. A partir del tema y de las fuentes,",
      "diseña el esquema de un artículo: un título atractivo y entre 4 y 7 secciones, cada",
      "una con un titular y una frase que resuma su enfoque. No escribas el artículo todavía.",
      "",
      "Tema: {{topic}}",
      "",
      "Fuentes de referencia:",
      "{{sources}}",
    ].join("\n"),
  },
  draft: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un redactor de blog. Escribe un artículo completo en español, en formato Markdown,",
      "siguiendo el esquema propuesto y apoyándote en las fuentes. Usa un tono claro y útil,",
      "con encabezados (##) por sección. No inventes datos que no estén en las fuentes.",
      "",
      "Tema: {{topic}}",
      "",
      "Esquema:",
      "{{outline}}",
      "",
      "Fuentes:",
      "{{sources}}",
    ].join("\n"),
  },
  validate: {
    // Etapa "juez": por defecto un modelo más capaz para revisar con criterio.
    model: "anthropic/claude-3.5-sonnet",
    prompt: [
      "Eres un revisor crítico. Evalúa el borrador del artículo respecto al tema y a las",
      "fuentes. Señala imprecisiones, afirmaciones sin respaldo, vacíos y problemas de",
      "estructura. Devuelve una valoración accionable; sé conciso.",
      "",
      "Tema: {{topic}}",
      "",
      "Borrador:",
      "{{draft}}",
      "",
      "Fuentes:",
      "{{sources}}",
    ].join("\n"),
  },
  "humanize-seo": {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Reescribe el borrador para que suene natural y humano (evita muletillas de IA y",
      "frases genéricas), manteniendo el contenido y el formato Markdown. Después, propón",
      "metadatos SEO: una meta description (<=155 caracteres), un slug y de 4 a 8 keywords.",
      "",
      "Tema: {{topic}}",
      "",
      "Borrador:",
      "{{draft}}",
    ].join("\n"),
  },
};
