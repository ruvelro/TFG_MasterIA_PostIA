import { analyzeProseRhythm } from "@/lib/pipeline/prose-rhythm";
import type { FactualReview, QualityReview, ValidationReport } from "@/lib/pipeline/schemas";

// Los jueces pueden desobedecer la política editorial y pedir enlaces, referencias o bibliografías.
// Se descartan esas recomendaciones antes de guardarlas o pasarlas al fixer; las atribuciones a
// actores originales (modelos, declaraciones, encuestas) no coinciden con estos patrones.
const FORBIDDEN_SOURCE_ADVICE = [
  /\b(?:a[nñ]ad\w*|agreg\w*|inclu\w*|incorpor\w*|insert\w*).{0,100}\b(?:enlaces?|links?|hiperv[ií]nculos?|bibliograf[ií]a|referencias?|listas? de fuentes?)\b/i,
  /\b(?:enlaces?|links?|hiperv[ií]nculos?|bibliograf[ií]a|referencias?|listas? de fuentes?).{0,100}\b(?:a[nñ]ad\w*|agreg\w*|inclu\w*|incorpor\w*|insert\w*)\b/i,
];

export function requestsVisibleSources(text: string): boolean {
  return FORBIDDEN_SOURCE_ADVICE.some((pattern) => pattern.test(text));
}

export function sanitizeValidationReport(report: ValidationReport): ValidationReport {
  const issues = report.issues.filter(
    (issue) => !requestsVisibleSources(`${issue.description} ${issue.suggestion}`),
  );
  const removedContradictoryIssue = issues.length < report.issues.length;
  return {
    passed:
      report.passed ||
      (removedContradictoryIssue && issues.every((issue) => issue.severity === "low")),
    issues,
  };
}

export function sanitizeFactualReview(report: FactualReview): FactualReview {
  const claims = report.claims.map((claim) => {
    if (claim.evidenceType === "contradicted") return { ...claim, status: "discarded" as const };
    if (claim.evidenceType === "inferred" || claim.evidenceType === "unsupported") {
      return { ...claim, status: "doubtful" as const };
    }
    return claim;
  });
  const hasDiscarded = claims.some((claim) => claim.status === "discarded");
  const hasDoubtful = claims.some((claim) => claim.status === "doubtful");
  return {
    ...report,
    claims,
    riskLevel: hasDiscarded ? "high" : hasDoubtful ? "medium" : report.riskLevel,
  };
}

interface QualitySanitizerOptions {
  draft: string;
  aiScoreThreshold: number;
}

export function sanitizeQualityReview(
  report: QualityReview,
  options?: QualitySanitizerOptions,
): QualityReview {
  const issues = report.issues.filter(
    (issue) => !requestsVisibleSources(`${issue.description} ${issue.suggestion}`),
  );
  const rhythm = options ? analyzeProseRhythm(options.draft) : null;
  const hasUniformityIssue = issues.some(
    (issue) => issue.category === "ai-tone" && /ritmo|p[aá]rrafo|uniform/i.test(issue.description),
  );
  if (rhythm?.artificiallyUniform && !hasUniformityIssue && rhythm.dominantBand) {
    issues.push({
      category: "ai-tone",
      description: `${rhythm.dominantBand.paragraphCount} de ${rhythm.paragraphCount} párrafos se concentran entre ${rhythm.dominantBand.minWords} y ${rhythm.dominantBand.maxWords} palabras; la cadencia resulta demasiado uniforme.`,
      suggestion:
        "Fusiona o divide párrafos según cambie la idea y alterna desarrollos breves y largos sin crear un patrón mecánico.",
    });
  }
  return {
    ...report,
    aiScore:
      rhythm?.artificiallyUniform && options
        ? Math.max(report.aiScore, options.aiScoreThreshold)
        : report.aiScore,
    issues,
    suggestions: report.suggestions.filter((suggestion) => !requestsVisibleSources(suggestion)),
  };
}
