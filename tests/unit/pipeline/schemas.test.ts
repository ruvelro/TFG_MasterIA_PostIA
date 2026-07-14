import { describe, expect, it } from "vitest";

import {
  ArticleMetadataSchema,
  BlueprintSchema,
  FactsSchema,
  FixerOutputSchema,
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
