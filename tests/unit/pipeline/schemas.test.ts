import { describe, expect, it } from "vitest";

import {
  ArticleMetadataSchema,
  BlueprintSchema,
  FactsSchema,
  FixerOutputSchema,
  QualityReviewSchema,
  ValidationReportSchema,
} from "@/lib/pipeline/schemas";

describe("esquemas del pipeline", () => {
  it("FactsSchema acepta hechos con su cita y rechaza los que no la tienen", () => {
    expect(FactsSchema.safeParse({ facts: [{ claim: "c", source: "https://x" }] }).success).toBe(
      true,
    );
    expect(FactsSchema.safeParse({ facts: [{ claim: "c" }] }).success).toBe(false);
  });

  it("BlueprintSchema exige secciones con titular y resumen", () => {
    expect(
      BlueprintSchema.safeParse({
        title: "t",
        angle: "a",
        readerPromise: "p",
        mainThesis: "tesis",
        leadAngle: "lead",
        excludeOrCompress: ["secundario"],
        targetKeyword: "k",
        sections: [{ heading: "h", summary: "s" }],
      }).success,
    ).toBe(true);
  });

  it("ValidationReportSchema solo admite categorías conocidas", () => {
    expect(ValidationReportSchema.safeParse({ passed: true, issues: [] }).success).toBe(true);
    expect(
      ValidationReportSchema.safeParse({
        passed: false,
        issues: [{ category: "inventada", severity: "low", description: "d", suggestion: "s" }],
      }).success,
    ).toBe(false);
  });

  it("QualityReviewSchema exige una categoría accionable en cada issue", () => {
    const base = {
      structureScore: 80,
      factualSupportScore: 80,
      seoScore: 80,
      wordCount: 700,
      aiScore: 30,
      suggestions: [],
    };
    expect(
      QualityReviewSchema.safeParse({
        ...base,
        issues: [
          {
            category: "ai-tone",
            description: "Ritmo uniforme",
            suggestion: "Variar construcciones",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      QualityReviewSchema.safeParse({
        ...base,
        issues: [{ description: "Sin categoría", suggestion: "Corregir" }],
      }).success,
    ).toBe(false);
  });

  it("FixerOutputSchema requiere el artículo y los metadatos SEO", () => {
    expect(
      FixerOutputSchema.safeParse({
        contentMarkdown: "x",
        title: "t",
        slug: "s",
        metaDescription: "m",
        keywords: ["a"],
      }).success,
    ).toBe(true);
  });

  it("ArticleMetadataSchema no permite que el finalizador reescriba el cuerpo", () => {
    const result = ArticleMetadataSchema.safeParse({
      title: "Título",
      slug: "titulo",
      metaDescription: "Descripción",
      keywords: ["tema"],
      contentMarkdown: "Texto que no pertenece a este contrato",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("contentMarkdown");
  });
});
