import type { StageId } from "@/lib/pipeline/stages";

/**
 * Configuración por defecto de las etapas que usan IA.
 *
 * `research` no aparece aquí porque no usa modelos (usa APIs de búsqueda). Estos valores
 * son los predeterminados de fábrica: el administrador puede sobreescribir modelo y prompt
 * desde el panel, y cada generación puede aún hacer un override puntual. Los prompts son
 * plantillas con marcadores `{{...}}` que el pipeline rellena con el contexto acumulado:
 * `{{topic}} {{sources}} {{facts}} {{blueprint}} {{draft}} {{report}} {{editorialVoice}}
 * {{seoRules}} {{geoRules}} {{formatDirectives}} {{targetKeyword}} {{article}}`.
 */
export interface StepConfig {
  /** Identificador de modelo de OpenRouter, p. ej. "google/gemini-2.5-flash". */
  model: string;
  /** Plantilla de prompt que se envía al modelo. */
  prompt: string;
}

/** Etapas que usan IA, en orden. La validación de la app se apoya en este conjunto. */
export const AI_STAGE_IDS = [
  "extract",
  "blueprint",
  "draft",
  "humanize",
  "validate",
  "factual-review",
  "quality-review",
  "fixer",
  "enrich",
] as const;

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
      "Respeta las directrices de formato del tipo de noticia, si las hay.",
      "",
      "Tema: {{topic}}",
      "",
      "Directrices de formato:",
      "{{formatDirectives}}",
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
      "Respeta las directrices de formato (longitud, estilo de pieza, uso de fuentes).",
      "",
      "Tema: {{topic}}",
      "",
      "Directrices de formato:",
      "{{formatDirectives}}",
      "",
      "Estructura:",
      "{{blueprint}}",
      "",
      "Hechos (fuente de verdad):",
      "{{facts}}",
      "",
      "Voz editorial (respeta también las palabras prohibidas que incluya):",
      "{{editorialVoice}}",
      "",
      "Reglas SEO (optimización para buscadores):",
      "{{seoRules}}",
      "",
      "Reglas GEO (optimización para motores generativos):",
      "{{geoRules}}",
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
      "- editorial: incumplimientos de la voz editorial o uso de palabras prohibidas.",
      "- seo: incumplimientos de las reglas SEO o GEO.",
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
      "Reglas SEO:",
      "{{seoRules}}",
      "",
      "Reglas GEO:",
      "{{geoRules}}",
    ].join("\n"),
  },
  humanize: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un escritor especializado en estilo natural y directo. El borrador siguiente contiene",
      "patrones típicos de IA que debes eliminar: muletillas ('es importante destacar', 'en",
      "conclusión', 'cabe señalar', 'en el panorama actual'), párrafos de longitud uniforme, voz",
      "pasiva excesiva y transiciones mecánicas.",
      "",
      "Reescribe el artículo manteniendo TODOS los hechos, la estructura de secciones y el",
      "Markdown (encabezados ##, negritas **). No inventes datos nuevos. Varía la longitud de",
      "las frases y párrafos. Devuelve únicamente el Markdown reescrito, sin explicaciones.",
      "",
      "Voz editorial de referencia:",
      "{{editorialVoice}}",
      "",
      "Borrador a humanizar:",
      "{{draft}}",
    ].join("\n"),
  },
  "factual-review": {
    // Etapa "juez" factual: modelo capaz para verificar con criterio independiente.
    model: "anthropic/claude-3.5-sonnet",
    prompt: [
      "Eres un verificador de hechos. Para cada afirmación factual relevante del artículo,",
      "determina si está respaldada por los hechos/fuentes disponibles ('confirmed'), es",
      "cuestionable o no puedes confirmarla ('doubtful'), o no tiene ningún respaldo y debería",
      "eliminarse ('discarded'). Emite un nivel de riesgo global: 'low' si la mayoría están",
      "confirmadas, 'medium' si hay dudas relevantes, 'high' si hay afirmaciones descartables.",
      "Indica también si las fuentes son suficientes para respaldar el artículo",
      "('researchSufficiency.sufficient': true/false, 'reason': breve explicación de una frase).",
      "",
      "Tema: {{topic}}",
      "",
      "Hechos verificados (fuente de verdad):",
      "{{facts}}",
      "",
      "Artículo a revisar:",
      "{{draft}}",
    ].join("\n"),
  },
  "quality-review": {
    // Modelo distinto al de validate para reducir sesgo de confirmación.
    model: "anthropic/claude-3.5-sonnet",
    prompt: [
      "Eres un auditor editorial. Puntúa el artículo en las siguientes dimensiones (escala 0-100):",
      "- structureScore: claridad y coherencia de la estructura y el flujo narrativo.",
      "- factualSupportScore: porcentaje estimado de afirmaciones con respaldo factual claro.",
      "- seoScore: cumplimiento de las reglas SEO y GEO proporcionadas.",
      "- aiScore: sabor a IA del texto (0 = totalmente humano, 100 = totalmente IA).",
      "Estima también el wordCount. Incluye una lista de issues concretos (description + suggestion)",
      "y sugerencias generales de mejora.",
      "",
      "Tema: {{topic}}",
      "",
      "Reglas SEO (buscadores):",
      "{{seoRules}}",
      "",
      "Reglas GEO (motores generativos):",
      "{{geoRules}}",
      "",
      "Artículo:",
      "{{draft}}",
    ].join("\n"),
  },
  fixer: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un editor corrector. Aplica al borrador TODAS las correcciones de los informes de",
      "revisión: reescribe las frases que suenen a IA, elimina o matiza las afirmaciones marcadas",
      "como dudosas o descartadas, ajusta lo que incumpla la voz editorial o el SEO/GEO. Resalta",
      "en negrita (**) las frases o datos clave. Después, genera la meta SEO final (título, slug,",
      "meta description <=155 caracteres y keywords). Mantén el formato Markdown y no inventes",
      "datos nuevos.",
      "",
      "Tema: {{topic}}",
      "",
      "Borrador actual:",
      "{{draft}}",
      "",
      "Informes de revisión a corregir:",
      "{{report}}",
      "",
      "Voz editorial (respeta también las palabras prohibidas que incluya):",
      "{{editorialVoice}}",
      "",
      "Reglas SEO (buscadores):",
      "{{seoRules}}",
      "",
      "Reglas GEO (motores generativos):",
      "{{geoRules}}",
    ].join("\n"),
  },
  enrich: {
    model: "google/gemini-2.5-flash",
    prompt: [
      "Eres un especialista en SEO y distribución de contenidos. A partir del artículo final,",
      "genera los siguientes elementos. Todo en español SALVO `featuredImagePrompt` que va en inglés:",
      "",
      "- headlineVariants: entre 3 y 5 titulares alternativos, variados en tono y estructura.",
      "  Ninguno debe ser clickbait ni exagerar. El primero debe ser el más directo.",
      "- tags: entre 4 y 8 etiquetas temáticas breves (1-3 palabras), sin repetir keywords.",
      "- faq: entre 0 y 6 pares pregunta/respuesta. Solo preguntas que el artículo responde",
      "  directamente. Respuestas de 1-2 frases, basadas en hechos del artículo.",
      "- imageAlt: entre 1 y 3 descripciones alt para la imagen destacada. Descriptivas,",
      "  ≤125 caracteres cada una.",
      "- jsonLdNewsArticle: objeto JSON-LD Schema.org tipo NewsArticle con al menos:",
      "  @context, @type, headline, description, keywords, datePublished (ISO hoy).",
      "- featuredImagePrompt: prompt en inglés para generar la imagen destacada con IA.",
      "  Describe la imagen visual que mejor ilustraría el artículo (≤200 palabras).",
      "",
      "Tema: {{topic}}",
      "Keyword objetivo: {{targetKeyword}}",
      "",
      "Artículo final:",
      "{{article}}",
    ].join("\n"),
  },
};

/**
 * Valores numéricos por defecto de los parámetros del pipeline que no pertenecen a etapas
 * concretas (bucles y umbrales). Los patrones de limpieza viven en `steps/scrub.ts`
 * (`DEFAULT_SCRUB_PATTERNS`), su hogar canónico. El admin puede sobreescribir todos ellos.
 */
export const DEFAULT_PIPELINE_PARAMS = {
  maxFixIterations: 2,
  maxHumanizeRetries: 2,
  aiScoreThreshold: 70,
} as const;
