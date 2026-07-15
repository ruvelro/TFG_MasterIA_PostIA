import { z } from "zod";

/**
 * Esquemas Zod de las salidas ESTRUCTURADAS de las etapas de IA. El AI SDK obliga al
 * modelo a producir exactamente esta forma (`generateObject`), de modo que el resto del
 * pipeline trabaja con datos tipados y validados, no con texto libre que haya que parsear.
 */

/**
 * Salida de la expansión de consultas de research: consultas complementarias al tema literal
 * para diversificar las fuentes. Es una micro-llamada auxiliar de la etapa research (no una
 * etapa del catálogo), con un modelo barato configurable por el admin.
 */
export const QueryExpansionSchema = z.object({
  queries: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe("Consultas de búsqueda complementarias al tema (2-3)"),
});
export type QueryExpansion = z.infer<typeof QueryExpansionSchema>;

export const FactSchema = z.object({
  claim: z.string().describe("Hecho concreto y verificable"),
  source: z
    .string()
    .describe("URL de procedencia o 'contexto adicional del usuario' cuando el dato vino sin URL"),
});

export const FactsSchema = z.object({
  facts: z.array(FactSchema),
});
export type Facts = z.infer<typeof FactsSchema>;

export const BlueprintSectionSchema = z.object({
  heading: z.string(),
  summary: z.string(),
});

export const BlueprintSchema = z.object({
  title: z.string().describe("Titular de trabajo del artículo"),
  angle: z.string().describe("Enfoque o ángulo principal"),
  readerPromise: z
    .string()
    .describe("Promesa concreta para el lector: qué entenderá o podrá decidir tras leer"),
  mainThesis: z.string().describe("Tesis editorial que organiza la pieza y evita el resumen plano"),
  leadAngle: z.string().describe("Dato, tensión o idea que debe abrir la entradilla"),
  excludeOrCompress: z
    .array(z.string())
    .describe("Datos o enfoques secundarios que deben omitirse o comprimirse"),
  targetKeyword: z.string(),
  sections: z.array(BlueprintSectionSchema),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

export const ISSUE_CATEGORIES = ["faithfulness", "ai-tone", "editorial", "seo"] as const;
export const ISSUE_SEVERITIES = ["low", "medium", "high"] as const;

export const ValidationIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  severity: z.enum(ISSUE_SEVERITIES),
  description: z.string(),
  suggestion: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z.object({
  passed: z.boolean().describe("Verdadero solo si no hay problemas relevantes"),
  issues: z.array(ValidationIssueSchema),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const ArticleMetadataSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaDescription: z.string().describe("Meta description SEO (<=155 caracteres)"),
  keywords: z.array(z.string()),
});
export type ArticleMetadata = z.infer<typeof ArticleMetadataSchema>;

export const FixerOutputSchema = ArticleMetadataSchema.extend({
  contentMarkdown: z.string().describe("Artículo final corregido en Markdown"),
});
export type FixerOutput = z.infer<typeof FixerOutputSchema>;

// ── Revisión factual ──────────────────────────────────────────────────────────

export const FactualClaimSchema = z.object({
  claim: z.string().describe("Afirmación factual verificable tal y como aparece en el artículo"),
  status: z
    .enum(["confirmed", "doubtful", "discarded"])
    .describe(
      "Solo para hechos: confirmed si está respaldado; doubtful si es cuestionable; discarded si contradice las fuentes. No clasifica opiniones ni hipótesis editoriales marcadas como tales",
    ),
  evidenceType: z
    .enum(["direct", "inferred", "unsupported", "contradicted"])
    .describe("Relación entre la afirmación y la evidencia disponible"),
  sourceAuthority: z
    .enum(["primary", "secondary", "mixed", "unknown"])
    .describe("Autoridad de las fuentes que sostienen la afirmación"),
  reason: z.string().describe("Breve explicación del estado asignado"),
});

export const FactualReviewSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]).describe("Nivel de riesgo global del artículo"),
  claims: z.array(FactualClaimSchema),
  summary: z.string().describe("Resumen ejecutivo de la revisión factual"),
  researchSufficiency: z
    .object({
      sufficient: z
        .boolean()
        .describe("¿Son las fuentes suficientes para respaldar los datos factuales del artículo?"),
      reason: z.string().describe("Breve explicación"),
    })
    .describe("Evaluación de si las fuentes consultadas bastan para respaldar el contenido"),
});
export type FactualReview = z.infer<typeof FactualReviewSchema>;

// ── Control de calidad ────────────────────────────────────────────────────────

export const QUALITY_ISSUE_CATEGORIES = ["structure", "factual-support", "seo", "ai-tone"] as const;

export const QualityIssueSchema = z.object({
  category: z
    .enum(QUALITY_ISSUE_CATEGORIES)
    .describe("Dimensión responsable de la incidencia y etapa que debe corregirla"),
  description: z.string(),
  suggestion: z.string(),
});
export type QualityIssue = z.infer<typeof QualityIssueSchema>;

export const QualityReviewSchema = z.object({
  structureScore: z.number().min(0).max(100).describe("Claridad y coherencia de la estructura"),
  factualSupportScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Porcentaje de afirmaciones factuales con respaldo; excluye análisis señalado"),
  seoScore: z.number().min(0).max(100).describe("Cumplimiento de reglas SEO/GEO"),
  wordCount: z.number().int().describe("Recuento de palabras del artículo"),
  aiScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Sabor a IA: 0 = totalmente humano, 100 = totalmente IA"),
  issues: z.array(QualityIssueSchema),
  suggestions: z.array(z.string()),
});
export type QualityReview = z.infer<typeof QualityReviewSchema>;

// ── Enriquecimiento del artículo ──────────────────────────────────────────────

/** Campos generados por IA en el step `enrich` (ítems 7-12). */
export const EnrichStepOutputSchema = z.object({
  headlineVariants: z
    .array(z.string())
    .describe("3-5 titulares alternativos al principal, variados en tono y estructura"),
  tags: z.array(z.string()).describe("4-8 etiquetas temáticas breves"),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("0-6 pares pregunta/respuesta basados en hechos del artículo"),
  imageAlt: z
    .array(z.string())
    .describe("1-3 textos alt descriptivos para la imagen destacada (≤125 chars cada uno)"),
  featuredImagePrompt: z
    .string()
    .describe("Prompt en inglés para generar la imagen destacada con IA (≤200 palabras)"),
});
export type EnrichStepOutput = z.infer<typeof EnrichStepOutputSchema>;

/**
 * Output de enriquecimiento completo: los campos creativos del step `enrich` más
 * `aiDetection`, `qualitySummary` y `jsonLdNewsArticle`, que el orquestador computa sin
 * llamadas IA adicionales a partir de datos ya disponibles en el contexto (título, meta
 * description y keywords del fixer). Que sea determinista evita depender de que el modelo
 * genere un JSON-LD válido —y de paso, el tipo de `z.record` que usaba antes rompía la
 * validación de esquema estricta de algunos proveedores (p. ej. Azure OpenAI: `propertyNames`
 * no está permitido en su `response_format`).
 */
export const ArticleEnrichmentSchema = EnrichStepOutputSchema.extend({
  /**
   * Sugerencias de enlaces internos a artículos relacionados del mismo usuario (con el
   * texto ancla propuesto). Las añade a posteriori el servicio de embeddings; opcional
   * porque depende de que los embeddings estén operativos y haya artículos previos.
   */
  internalLinks: z
    .array(
      z.object({
        articleId: z.string(),
        title: z.string(),
        slug: z.string(),
        anchorText: z.string(),
        similarity: z.number().min(0).max(1),
      }),
    )
    .optional(),
  aiDetection: z.object({
    score: z.number().min(0).max(100).describe("0=totalmente humano, 100=totalmente IA"),
    label: z.enum(["humano", "mixto", "ia"]),
  }),
  jsonLdNewsArticle: z
    .record(z.string(), z.unknown())
    .describe("Objeto Schema.org NewsArticle completo para SEO estructurado"),
  qualitySummary: z.object({
    groundedness: z
      .number()
      .min(0)
      .max(100)
      .describe("Porcentaje de afirmaciones confirmadas por las fuentes"),
    aiDetectionScore: z.number().min(0).max(100),
    factualRisk: z.enum(["low", "medium", "high"]),
    qualityRisk: z.enum(["low", "medium", "high"]),
    warningsCount: z.number().int().describe("Total de issues detectados en todos los informes"),
    // Si el artículo entregado pasó la validación final. Es `false` cuando el bucle agota las
    // iteraciones con un informe aún no superado (el corrector actuó pero no se revalidó). Con
    // default `true` para que los artículos guardados antes de este campo sigan siendo válidos.
    validationPassed: z.boolean().default(true),
  }),
});
export type ArticleEnrichment = z.infer<typeof ArticleEnrichmentSchema>;

// ── Patrones de limpieza (scrub) ──────────────────────────────────────────────

export const ScrubPatternSchema = z.object({
  /** Expresión regular (se aplica con flags gi). */
  pattern: z.string(),
  replacement: z.string().default(""),
});
export type ScrubPattern = z.infer<typeof ScrubPatternSchema>;

// ── Estilo editorial de la marca ──────────────────────────────────────────────

/**
 * Perfil de estilo editorial: define CÓMO escribe la publicación. Sustituye a la antigua
 * "voz editorial" plana. Se puede editar a mano o entrenar desde URLs con IA (el analizador
 * produce exactamente esta forma). Los campos `seoRules`/`geoRules` son la palanca de
 * optimización (hacia buscadores o hacia motores generativos); el resto es voz y autoridad.
 */
export const StyleProfileSchema = z.object({
  brandVoice: z.string().describe("Tono y personalidad de la marca"),
  houseRules: z.string().describe("Reglas de casa: qué hacer y qué evitar al redactar"),
  eeatAuthor: z.string().describe("Credenciales E-E-A-T del autor o del medio"),
  seoRules: z.string().describe("Directrices de optimización para buscadores (SEO)"),
  geoRules: z.string().describe("Directrices de optimización para motores generativos (GEO)"),
  languageRegion: z.string().describe("Idioma, variedad y registro (p. ej. español de España)"),
  forbiddenWords: z.array(z.string()).describe("Palabras o frases vetadas (muletillas de IA)"),
  fewShotExamples: z
    .array(z.string())
    .describe("Párrafos de referencia que ejemplifican el estilo"),
});
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

/**
 * Salida del analizador de estilo (entrenamiento desde URLs). Es un subconjunto del perfil:
 * las reglas SEO/GEO NO se infieren de artículos sueltos (son política editorial), así que el
 * analizador las deja vacías y el admin las completa a mano.
 */
export const StyleAnalysisResultSchema = StyleProfileSchema.omit({
  seoRules: true,
  geoRules: true,
});
export type StyleAnalysisResult = z.infer<typeof StyleAnalysisResultSchema>;

// ── Tipos de noticia (catálogo editable) ──────────────────────────────────────

/**
 * Un "tipo de noticia" es un preset que adapta el pipeline a un formato editorial concreto
 * (nota breve, análisis en profundidad, etc.). Decide qué etapas opcionales se ejecutan y
 * aporta directrices de estructura y longitud. `research` no es desactivable: las fuentes son
 * la fuente de verdad de PostIA.
 */
export const NewsTypeSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  label: z.string().min(1),
  description: z.string(),
  enableHumanize: z.boolean(),
  enableFactualReview: z.boolean(),
  enableQualityReview: z.boolean(),
  /** Si es true, el artículo debe ceñirse ESTRICTAMENTE a las fuentes (sin conocimiento externo). */
  sourceStrict: z.boolean(),
  /** Instrucción extra de estructura que se inyecta en blueprint y draft. */
  structureInstruction: z.string(),
  /** Nº de palabras objetivo (0 = sin objetivo). Orientación para el redactor. */
  targetWordCount: z.number().int().min(0).max(10000),
  /**
   * Voz editorial ESPECÍFICA de este tipo de contenido. COMPLEMENTA (no reemplaza) al perfil de
   * estilo global del portal: una noticia rápida, un tutorial o una oferta comparten la voz de la
   * marca pero tienen su propio enfoque y forma de redactar. Se puede editar a mano o entrenar
   * desde URLs de ese tipo. Campos opcionales con default para no romper catálogos ya guardados.
   */
  voiceBrand: z.string().default(""),
  voiceHouseRules: z.string().default(""),
  voiceExamples: z.array(z.string()).default([]),
  /**
   * Genera la imagen destacada (etapa feature-image) con un modelo de imagen. Desactivada
   * por defecto: añade coste y no todos los flujos la necesitan. Opcional con default para
   * no romper catálogos ya guardados.
   */
  enableFeatureImage: z.boolean().default(false),
  /**
   * Frescura de las fuentes: limitar la búsqueda a los últimos N días (0 = sin filtro).
   * Útil para tipos de actualidad; los proveedores lo traducen a su parámetro nativo.
   * Opcional con default para no romper catálogos ya guardados.
   */
  freshnessDays: z.number().int().min(0).max(365).default(0),
});
export type NewsType = z.infer<typeof NewsTypeSchema>;

export const NewsTypeCatalogSchema = z.array(NewsTypeSchema);

// ── Presets de longitud (catálogo editable) ───────────────────────────────────

/**
 * Un preset de longitud define un rango de palabras objetivo (p. ej. "Breve", "Estándar",
 * "Extenso"). Se elige por generación e instruye al redactor sobre la extensión. Tiene
 * prioridad sobre el `targetWordCount` del tipo de noticia cuando ambos están presentes.
 */
export const LengthPresetSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
    label: z.string().min(1),
    minWords: z.number().int().min(0).max(20000),
    maxWords: z.number().int().min(1).max(20000),
  })
  .refine((p) => p.maxWords >= p.minWords, {
    error: "El máximo de palabras no puede ser menor que el mínimo",
    path: ["maxWords"],
  });
export type LengthPreset = z.infer<typeof LengthPresetSchema>;

export const LengthPresetCatalogSchema = z.array(LengthPresetSchema);

// ── Estilos de imagen (catálogo editable) ─────────────────────────────────────

/**
 * Un estilo de imagen define un modificador estético reutilizable para el generador de imágenes
 * independiente (p. ej. "Fotoperiodístico", "Ilustración plana"). El `promptSuffix` se añade al
 * prompt del usuario para dirigir el aspecto sin que tenga que reescribir la descripción estética
 * cada vez. Se guarda como JSON en `AppSetting`; el usuario elige uno al generar.
 */
export const ImageStyleSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  label: z.string().min(1),
  /** Texto que se concatena al prompt para inducir el estilo. Puede ir vacío ("sin estilo"). */
  promptSuffix: z.string().default(""),
});
export type ImageStyle = z.infer<typeof ImageStyleSchema>;

export const ImageStyleCatalogSchema = z.array(ImageStyleSchema);

// ── Validador editorial determinista (configurable) ───────────────────────────

/**
 * Una regla del validador editorial determinista. `enabled` la activa; `severity` decide si
 * un hallazgo bloquea la generación (`error` → fuerza una pasada del corrector) o solo informa
 * (`warning`). Es una capa complementaria al `validate` por IA, sin coste de tokens.
 */
export const ValidatorRuleSchema = z.object({
  enabled: z.boolean(),
  severity: z.enum(["error", "warning"]),
});

export const ValidatorConfigSchema = z.object({
  /** Detecta las palabras prohibidas del perfil de estilo en el borrador. */
  forbiddenWords: ValidatorRuleSchema,
  /** Detecta patrones (regex) típicos de redacción IA. */
  aiPatterns: ValidatorRuleSchema.extend({ patterns: z.array(z.string()) }),
  /** Detecta copia literal extensa desde las fuentes (mínimo de palabras del fragmento). */
  sourceOverlap: ValidatorRuleSchema.extend({ minPhraseWords: z.number().int().min(3).max(30) }),
  /** Detecta exceso de atribuciones visibles que convierten el texto en un resumen de fuentes. */
  attributionOveruse: ValidatorRuleSchema.extend({
    maxPerThousandWords: z.number().int().min(1).max(50),
  }).default({ enabled: true, severity: "error", maxPerThousandWords: 2 }),
});
export type ValidatorConfig = z.infer<typeof ValidatorConfigSchema>;
