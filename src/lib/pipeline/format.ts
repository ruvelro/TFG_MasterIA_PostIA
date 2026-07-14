import type {
  ArticleEnrichment,
  Blueprint,
  Facts,
  FactualReview,
  FixerOutput,
  LengthPreset,
  NewsType,
  QualityReview,
  StyleProfile,
  ValidationReport,
} from "@/lib/pipeline/schemas";
import type { PipelineSource } from "@/lib/pipeline/types";

/**
 * Serializadores de las partes del contexto a TEXTO, para inyectarlas en los prompts
 * (que son plantillas de texto). Se aíslan aquí para que las etapas queden limpias y el
 * formato sea consistente y testeable.
 */

/** Escapa comillas dobles para poder incrustar un valor en un atributo del delimitador. */
function escapeAttribute(value: string): string {
  return value.replace(/"/g, "&quot;");
}

/**
 * Serializa las fuentes envolviendo cada una en delimitadores inequívocos
 * (`<fuente n url>…</fuente>`): defensa frente a inyección de prompts. Las plantillas
 * instruyen al modelo para tratar TODO lo que hay dentro de esos bloques como datos,
 * nunca como instrucciones. Se neutraliza cualquier `</fuente>` dentro del contenido
 * para que una página no pueda cerrar su bloque y hacerse pasar por parte del prompt;
 * las fuentes que la heurística marcó como sospechosas se anotan en el delimitador.
 */
export function sourcesToText(sources: PipelineSource[]): string {
  if (sources.length === 0) return "(sin fuentes)";
  return sources
    .map((source, index) => {
      const content = source.content.replace(/<(\/?)fuente\b/gi, "&lt;$1fuente");
      const suspiciousAttr = source.suspicious ? ' sospechosa="true"' : "";
      const openTag = `<fuente n="${index + 1}" titulo="${escapeAttribute(source.title)}" url="${escapeAttribute(source.url)}"${suspiciousAttr}>`;
      return `${openTag}\n${content}\n</fuente>`;
    })
    .join("\n\n");
}

export function factsToText(facts: Facts): string {
  if (facts.facts.length === 0) return "(sin hechos)";
  return facts.facts.map((fact) => `- ${fact.claim} (fuente: ${fact.source})`).join("\n");
}

/**
 * Renderiza las directrices de formato (estructura, longitud y modo de fuentes) para inyectarlas
 * en los prompts de blueprint y draft vía `{{formatDirectives}}`. Combina el tipo de noticia y el
 * preset de longitud: el preset MANDA sobre el `targetWordCount` del tipo cuando ambos existen.
 * Devuelve cadena vacía si no hay nada que indicar, sin ensuciar el prompt.
 */
export function newsTypeDirectivesToText(
  newsType: NewsType | undefined,
  lengthPreset?: LengthPreset,
): string {
  const parts: string[] = [];
  if (newsType?.structureInstruction.trim()) {
    parts.push(`Formato: ${newsType.structureInstruction.trim()}`);
  }
  // Prioridad de la longitud: preset seleccionado > targetWordCount del tipo.
  if (lengthPreset) {
    parts.push(`Longitud: entre ${lengthPreset.minWords} y ${lengthPreset.maxWords} palabras.`);
  } else if (newsType && newsType.targetWordCount > 0) {
    parts.push(`Longitud objetivo: aproximadamente ${newsType.targetWordCount} palabras.`);
  }
  if (newsType?.sourceStrict) {
    parts.push(
      "Cíñete ESTRICTAMENTE a los hechos de las fuentes: no añadas conocimiento externo ni datos sin respaldo.",
    );
  }
  return parts.join("\n");
}

/**
 * Renderiza el perfil de estilo a texto para inyectarlo en `{{editorialVoice}}`. Incluye voz,
 * reglas de casa, autoridad, idioma, palabras prohibidas y ejemplos de referencia. Las reglas
 * SEO/GEO se inyectan por separado (`{{seoRules}}` / `{{geoRules}}`), por ser la palanca de
 * optimización. Las secciones vacías se omiten para no ensuciar el prompt.
 */
export function styleProfileToText(profile: StyleProfile): string {
  const parts: string[] = [];
  if (profile.brandVoice.trim()) parts.push(`VOZ DE MARCA:\n${profile.brandVoice.trim()}`);
  if (profile.houseRules.trim()) parts.push(`REGLAS DE CASA:\n${profile.houseRules.trim()}`);
  if (profile.eeatAuthor.trim()) parts.push(`AUTORIDAD (E-E-A-T):\n${profile.eeatAuthor.trim()}`);
  if (profile.languageRegion.trim())
    parts.push(`IDIOMA Y REGIÓN: ${profile.languageRegion.trim()}`);

  const forbidden = profile.forbiddenWords.map((w) => w.trim()).filter(Boolean);
  if (forbidden.length > 0) {
    parts.push(`PALABRAS PROHIBIDAS (no usar nunca): ${forbidden.join(", ")}`);
  }

  const examples = profile.fewShotExamples.map((e) => e.trim()).filter(Boolean);
  if (examples.length > 0) {
    const rendered = examples.map((e) => `"""\n${e}\n"""`).join("\n");
    parts.push(`EJEMPLOS DE ESTILO DE REFERENCIA (imita su tono y ritmo):\n${rendered}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : "(sin perfil de estilo configurado)";
}

/**
 * Compone la voz editorial final que recibe el redactor: la voz GLOBAL del portal y, si el tipo
 * de noticia trae complemento propio, una sección añadida con su voz, reglas y ejemplos. El tipo
 * NO reemplaza la voz global: la matiza ("complementa"). Si el tipo no aporta complemento, devuelve
 * la voz global tal cual. `newsType` es opcional para los flujos que no fijan tipo (retrocompat).
 */
export function composeEditorialVoice(globalVoice: string, newsType?: NewsType): string {
  if (!newsType) return globalVoice;

  const parts: string[] = [];
  const brand = newsType.voiceBrand?.trim();
  const rules = newsType.voiceHouseRules?.trim();
  if (brand) parts.push(`VOZ DE ESTE TIPO:\n${brand}`);
  if (rules) parts.push(`REGLAS DE CASA DE ESTE TIPO:\n${rules}`);

  const examples = (newsType.voiceExamples ?? []).map((e) => e.trim()).filter(Boolean);
  if (examples.length > 0) {
    const rendered = examples.map((e) => `"""\n${e}\n"""`).join("\n");
    parts.push(`EJEMPLOS DE REFERENCIA DE ESTE TIPO (imita su tono y ritmo):\n${rendered}`);
  }

  if (parts.length === 0) return globalVoice;

  const typeBlock = [
    `── Enfoque específico para "${newsType.label}" (complementa la voz del portal) ──`,
    ...parts,
  ].join("\n\n");
  return `${globalVoice}\n\n${typeBlock}`;
}

export function blueprintToText(blueprint: Blueprint): string {
  const sections = blueprint.sections
    .map((section, index) => `${index + 1}. ${section.heading} — ${section.summary}`)
    .join("\n");
  return [
    `Titular: ${blueprint.title}`,
    `Ángulo: ${blueprint.angle}`,
    `Promesa al lector: ${blueprint.readerPromise}`,
    `Tesis principal: ${blueprint.mainThesis}`,
    `Entradilla debe abrir con: ${blueprint.leadAngle}`,
    `Omitir o comprimir: ${
      blueprint.excludeOrCompress.length > 0 ? blueprint.excludeOrCompress.join("; ") : "(nada)"
    }`,
    `Keyword objetivo: ${blueprint.targetKeyword}`,
    "Secciones:",
    sections,
  ].join("\n");
}

export function reportToText(report: ValidationReport): string {
  if (report.issues.length === 0) return "(sin problemas)";
  return report.issues
    .map(
      (issue) =>
        `- [${issue.category}/${issue.severity}] ${issue.description} → ${issue.suggestion}`,
    )
    .join("\n");
}

export function factualReviewToText(report: FactualReview): string {
  const claims = report.claims.map((c) => `- [${c.status}] ${c.claim} — ${c.reason}`).join("\n");
  return [`Nivel de riesgo: ${report.riskLevel}`, report.summary, claims]
    .filter(Boolean)
    .join("\n");
}

export function qualityReviewToText(report: QualityReview): string {
  const scores = [
    `Estructura: ${report.structureScore}/100`,
    `Soporte factual: ${report.factualSupportScore}/100`,
    `SEO: ${report.seoScore}/100`,
    `Sabor IA: ${report.aiScore}/100`,
    `Palabras: ${report.wordCount}`,
  ].join(" | ");
  const issues = report.issues.map((i) => `- ${i.description} → ${i.suggestion}`).join("\n");
  const suggestions = report.suggestions.map((s) => `• ${s}`).join("\n");
  return [scores, issues && `Issues:\n${issues}`, suggestions && `Sugerencias:\n${suggestions}`]
    .filter(Boolean)
    .join("\n");
}

/**
 * Consolida los tres informes de revisión en un único bloque de texto para el fixer.
 * Siempre incluye el informe de validación; los otros dos son opcionales (pueden no
 * existir si la configuración los omite o si todavía no se han ejecutado).
 */
export function combinedReviewToText(
  validation: ValidationReport,
  factual?: FactualReview,
  quality?: QualityReview,
): string {
  const parts: string[] = ["=== Validación editorial ===", reportToText(validation)];
  if (factual) {
    parts.push("=== Revisión factual ===", factualReviewToText(factual));
  }
  if (quality) {
    parts.push("=== Control de calidad ===", qualityReviewToText(quality));
  }
  return parts.join("\n\n");
}

/**
 * Computa `aiDetection` a partir del `aiScore` ya disponible en `qualityReport`.
 * Es determinista (sin IA): 0-24 = humano, 25-59 = mixto, ≥60 = ia.
 */
export function computeAiDetection(aiScore: number): ArticleEnrichment["aiDetection"] {
  const label = aiScore < 25 ? "humano" : aiScore < 60 ? "mixto" : "ia";
  return { score: aiScore, label };
}

export function computeQualityRisk(
  qualityReport: QualityReview,
): ArticleEnrichment["qualitySummary"]["qualityRisk"] {
  const lowestScore = Math.min(
    qualityReport.structureScore,
    qualityReport.factualSupportScore,
    qualityReport.seoScore,
  );
  return lowestScore >= 75 ? "low" : lowestScore >= 50 ? "medium" : "high";
}

/**
 * Computa `qualitySummary` a partir de los tres informes de revisión ya disponibles.
 * No requiere llamadas IA adicionales.
 */
export function computeQualitySummary(
  report: ValidationReport,
  factualReport: FactualReview,
  qualityReport: QualityReview,
  validationPassed: boolean,
): ArticleEnrichment["qualitySummary"] {
  const confirmedRatio =
    factualReport.claims.length > 0
      ? factualReport.claims.filter((c) => c.status === "confirmed").length /
        factualReport.claims.length
      : 1;
  const groundedness = Math.round(confirmedRatio * 100);

  const qualityRisk = computeQualityRisk(qualityReport);

  const warningsCount =
    report.issues.length +
    factualReport.claims.filter((c) => c.status !== "confirmed").length +
    qualityReport.issues.length;

  return {
    groundedness,
    aiDetectionScore: qualityReport.aiScore,
    factualRisk: factualReport.riskLevel,
    qualityRisk,
    warningsCount,
    validationPassed,
  };
}

/**
 * Construye el JSON-LD Schema.org NewsArticle a partir de datos YA disponibles en el contexto
 * (título, meta description y keywords que fijó el fixer). Es determinista y no requiere IA:
 * antes se le pedía al modelo que generase este objeto libremente, pero un `z.record` en el
 * esquema de salida rompía la validación estricta de `response_format` en proveedores como
 * Azure OpenAI (rechazan la palabra clave `propertyNames` del JSON Schema resultante), y de
 * paso dependía de que el modelo no olvidara ningún campo obligatorio de Schema.org.
 */
export function computeNewsArticleJsonLd(
  article: FixerOutput,
): ArticleEnrichment["jsonLdNewsArticle"] {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.metaDescription,
    keywords: article.keywords.join(", "),
    datePublished: new Date().toISOString(),
  };
}
