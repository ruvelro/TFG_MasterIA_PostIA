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
