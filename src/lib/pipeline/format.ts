import type { Blueprint, Facts, ValidationReport } from "@/lib/pipeline/schemas";
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
