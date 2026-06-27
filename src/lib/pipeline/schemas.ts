import { z } from "zod";

/**
 * Esquemas Zod de las salidas ESTRUCTURADAS de las etapas de IA. El AI SDK obliga al
 * modelo a producir exactamente esta forma (`generateObject`), de modo que el resto del
 * pipeline trabaja con datos tipados y validados, no con texto libre que haya que parsear.
 */

export const FactSchema = z.object({
  claim: z.string().describe("Hecho concreto y verificable"),
  source: z.string().describe("URL de la fuente de la que proviene el hecho"),
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

export const FixerOutputSchema = z.object({
  contentMarkdown: z.string().describe("Artículo final corregido en Markdown"),
  title: z.string(),
  slug: z.string(),
  metaDescription: z.string().describe("Meta description SEO (<=155 caracteres)"),
  keywords: z.array(z.string()),
});
export type FixerOutput = z.infer<typeof FixerOutputSchema>;

// ── Revisión factual ──────────────────────────────────────────────────────────

export const FactualClaimSchema = z.object({
  claim: z.string().describe("Afirmación tal y como aparece en el artículo"),
  status: z
    .enum(["confirmed", "doubtful", "discarded"])
    .describe("confirmed: respaldada por fuentes; doubtful: cuestionable; discarded: sin respaldo"),
  reason: z.string().describe("Breve explicación del estado asignado"),
});

export const FactualReviewSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]).describe("Nivel de riesgo global del artículo"),
  claims: z.array(FactualClaimSchema),
  summary: z.string().describe("Resumen ejecutivo de la revisión factual"),
  researchSufficiency: z
    .object({
      sufficient: z.boolean().describe("¿Son las fuentes suficientes para respaldar el artículo?"),
      reason: z.string().describe("Breve explicación"),
    })
    .describe("Evaluación de si las fuentes consultadas bastan para respaldar el contenido"),
});
export type FactualReview = z.infer<typeof FactualReviewSchema>;

// ── Control de calidad ────────────────────────────────────────────────────────

export const QualityReviewSchema = z.object({
  structureScore: z.number().min(0).max(100).describe("Claridad y coherencia de la estructura"),
  factualSupportScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Porcentaje de afirmaciones con respaldo factual"),
  seoScore: z.number().min(0).max(100).describe("Cumplimiento de reglas SEO/GEO"),
  wordCount: z.number().int().describe("Recuento de palabras del artículo"),
  aiScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Sabor a IA: 0 = totalmente humano, 100 = totalmente IA"),
  issues: z.array(
    z.object({
      description: z.string(),
      suggestion: z.string(),
    }),
  ),
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
  jsonLdNewsArticle: z
    .record(z.string(), z.unknown())
    .describe("Objeto Schema.org NewsArticle completo para SEO estructurado"),
  featuredImagePrompt: z
    .string()
    .describe("Prompt en inglés para generar la imagen destacada con IA (≤200 palabras)"),
});
export type EnrichStepOutput = z.infer<typeof EnrichStepOutputSchema>;

/**
 * Output de enriquecimiento completo: los 6 campos creativos del step `enrich` más
 * `aiDetection` y `qualitySummary`, que el orquestador computa sin llamadas IA adicionales
 * a partir de los reportes ya existentes.
 */
export const ArticleEnrichmentSchema = EnrichStepOutputSchema.extend({
  aiDetection: z.object({
    score: z.number().min(0).max(100).describe("0=totalmente humano, 100=totalmente IA"),
    label: z.enum(["humano", "mixto", "ia"]),
  }),
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
});
export type ValidatorConfig = z.infer<typeof ValidatorConfigSchema>;
