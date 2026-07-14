import type { QualityReview, ValidationReport } from "@/lib/pipeline/schemas";

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

export function sanitizeQualityReview(report: QualityReview): QualityReview {
  return {
    ...report,
    issues: report.issues.filter(
      (issue) => !requestsVisibleSources(`${issue.description} ${issue.suggestion}`),
    ),
    suggestions: report.suggestions.filter((suggestion) => !requestsVisibleSources(suggestion)),
  };
}
