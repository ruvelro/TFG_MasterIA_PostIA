import type {
  ArticleEnrichment,
  Blueprint,
  Facts,
  FactualReview,
  QualityReview,
  ValidationReport,
} from "@/lib/pipeline/schemas";
import type { PipelineSource } from "@/lib/pipeline/types";

/**
 * Serializadores de las partes del contexto a TEXTO, para inyectarlas en los prompts
 * (que son plantillas de texto). Se aíslan aquí para que las etapas queden limpias y el
 * formato sea consistente y testeable.
 */

export function sourcesToText(sources: PipelineSource[]): string {
  if (sources.length === 0) return "(sin fuentes)";
  return sources
    .map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.content}`)
    .join("\n\n");
}

export function factsToText(facts: Facts): string {
  if (facts.facts.length === 0) return "(sin hechos)";
  return facts.facts.map((fact) => `- ${fact.claim} (fuente: ${fact.source})`).join("\n");
}

export function blueprintToText(blueprint: Blueprint): string {
  const sections = blueprint.sections
    .map((section, index) => `${index + 1}. ${section.heading} — ${section.summary}`)
    .join("\n");
  return [
    `Titular: ${blueprint.title}`,
    `Ángulo: ${blueprint.angle}`,
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
 * Es determinista (sin IA): 0-40 = humano, 41-69 = mixto, ≥70 = ia.
 */
export function computeAiDetection(aiScore: number): ArticleEnrichment["aiDetection"] {
  const label = aiScore <= 40 ? "humano" : aiScore <= 69 ? "mixto" : "ia";
  return { score: aiScore, label };
}

/**
 * Computa `qualitySummary` a partir de los tres informes de revisión ya disponibles.
 * No requiere llamadas IA adicionales.
 */
export function computeQualitySummary(
  report: ValidationReport,
  factualReport: FactualReview,
  qualityReport: QualityReview,
): ArticleEnrichment["qualitySummary"] {
  const confirmedRatio =
    factualReport.claims.length > 0
      ? factualReport.claims.filter((c) => c.status === "confirmed").length /
        factualReport.claims.length
      : 1;
  const groundedness = Math.round(confirmedRatio * 100);

  const avgQuality =
    (qualityReport.structureScore + qualityReport.factualSupportScore + qualityReport.seoScore) / 3;
  const qualityRisk: "low" | "medium" | "high" =
    avgQuality >= 75 ? "low" : avgQuality >= 50 ? "medium" : "high";

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
  };
}
