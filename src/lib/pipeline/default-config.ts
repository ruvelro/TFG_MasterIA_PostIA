import type { StageId } from "@/lib/pipeline/stages";

/**
 * Configuración por defecto de las etapas que usan IA.
 *
 * `research` no aparece aquí porque no usa modelos (usa APIs de búsqueda). Estos valores
 * son los predeterminados de fábrica: el administrador puede sobreescribir modelo y prompt
 * desde el panel, y cada generación puede aún hacer un override puntual. Los prompts son
 * plantillas con marcadores `{{...}}` que el pipeline rellena con el contexto acumulado:
 * `{{topic}} {{sources}} {{facts}} {{blueprint}} {{draft}} {{report}} {{editorialVoice}} {{seoRules}}`.
 */
export interface StepConfig {
  /** Identificador de modelo de OpenRouter, p. ej. "google/gemini-2.5-flash". */
  model: string;
  /** Plantilla de prompt que se envía al modelo. */
  prompt: string;
}

/** Etapas que usan IA, en orden. La validación de la app se apoya en este conjunto. */
export const AI_STAGE_IDS = ["extract", "blueprint", "draft", "validate", "fixer"] as const;

export type AiStageId = (typeof AI_STAGE_IDS)[number];

export function isAiStage(stageId: StageId): stageId is AiStageId {
  return (AI_STAGE_IDS as readonly string[]).includes(stageId);
}

export const DEFAULT_STEP_CONFIG: Record<AiStageId, StepConfig> = {
  extract: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un analista documental. A partir del contenido de las fuentes, extrae los HECHOS",
      "clave y verificables sobre el tema. Para cada hecho, indica la URL de la fuente exacta",
      "de la que proviene. No incluyas opiniones ni información que no esté en las fuentes.",
      "",
      "Tema: {{topic}}",
      "",
      "Fuentes (contenido descargado):",
      "{{sources}}",
    ].join("\n"),
  },
  blueprint: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un editor de contenidos. Con los hechos disponibles, diseña la ESTRUCTURA del",
      "artículo: un titular de trabajo, el ángulo, entre 4 y 7 secciones (con titular y un",
      "resumen de su enfoque) y una keyword objetivo. No escribas el artículo todavía.",
      "",
      "Tema: {{topic}}",
      "",
      "Hechos disponibles:",
      "{{facts}}",
    ].join("\n"),
  },
  draft: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un redactor profesional. Escribe el artículo completo en español, en Markdown,",
      "siguiendo la estructura propuesta y apoyándote ÚNICAMENTE en los hechos (no inventes).",
      "Aplica la voz editorial y las reglas SEO/GEO indicadas. Usa encabezados (##) por sección.",
      "",
      "Tema: {{topic}}",
      "",
      "Estructura:",
      "{{blueprint}}",
      "",
      "Hechos (fuente de verdad):",
      "{{facts}}",
      "",
      "Voz editorial:",
      "{{editorialVoice}}",
      "",
      "Reglas SEO/GEO:",
      "{{seoRules}}",
    ].join("\n"),
  },
  validate: {
    // Etapa "juez": por defecto un modelo más capaz para revisar con criterio.
    model: "anthropic/claude-3.5-sonnet",
    prompt: [
      "Eres un revisor editorial estricto. Evalúa el borrador y devuelve los problemas que",
      "encuentres, clasificados por categoría:",
      "- faithfulness: afirmaciones que no se apoyan en los hechos/fuentes o están inventadas.",
      "- ai-tone: frases que suenan a IA o genéricas (objetivo: 0% IA, 100% humano).",
      "- editorial: incumplimientos de la voz editorial.",
      "- seo: incumplimientos de las reglas SEO/GEO.",
      "Marca `passed` como verdadero solo si no hay problemas relevantes.",
      "",
      "Tema: {{topic}}",
      "",
      "Borrador:",
      "{{draft}}",
      "",
      "Hechos (fuente de verdad):",
      "{{facts}}",
      "",
      "Voz editorial:",
      "{{editorialVoice}}",
      "",
      "Reglas SEO/GEO:",
      "{{seoRules}}",
    ].join("\n"),
  },
  fixer: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un editor corrector. Aplica al borrador TODAS las correcciones del informe de",
      "validación: reescribe las frases marcadas como IA para que suenen humanas, ajusta lo",
      "que incumpla las fuentes, la voz editorial o el SEO/GEO. Resalta en negrita (**) las",
      "frases o datos clave. Después, genera la meta SEO final (título, slug, meta description",
      "<=155 caracteres y keywords). Mantén el formato Markdown y no inventes datos nuevos.",
      "",
      "Tema: {{topic}}",
      "",
      "Borrador actual:",
      "{{draft}}",
      "",
      "Informe de validación a corregir:",
      "{{report}}",
      "",
      "Voz editorial:",
      "{{editorialVoice}}",
      "",
      "Reglas SEO/GEO:",
      "{{seoRules}}",
    ].join("\n"),
  },
};
