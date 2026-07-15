import { describe, expect, it } from "vitest";

import {
  requestsVisibleSources,
  sanitizeFactualReview,
  sanitizeQualityReview,
  sanitizeValidationReport,
} from "@/lib/pipeline/review-sanitizer";

describe("sanitización de informes editoriales", () => {
  it("detecta recomendaciones que piden enlaces o referencias visibles", () => {
    expect(requestsVisibleSources("Incluye enlaces a las fuentes en los datos clave.")).toBe(true);
    expect(requestsVisibleSources("Añade una o dos referencias visibles al final.")).toBe(true);
    expect(requestsVisibleSources("Añade referencias de forma integrada en las frases.")).toBe(
      true,
    );
    expect(requestsVisibleSources("Atribuye el modelo propietario a Opta.")).toBe(false);
  });

  it("elimina consejos de fuentes visibles sin ocultar otros problemas", () => {
    const sanitized = sanitizeQualityReview({
      structureScore: 80,
      factualSupportScore: 80,
      seoScore: 80,
      wordCount: 700,
      aiScore: 20,
      issues: [
        {
          category: "factual-support",
          description: "Falta contexto en un porcentaje.",
          suggestion: "Incluye enlaces a las fuentes originales.",
        },
        {
          category: "structure",
          description: "La sede aparece dos veces.",
          suggestion: "Elimina la repetición.",
        },
      ],
      suggestions: ["Añade una bibliografía al final.", "Acorta la entradilla."],
    });

    expect(sanitized.issues).toEqual([
      {
        category: "structure",
        description: "La sede aparece dos veces.",
        suggestion: "Elimina la repetición.",
      },
    ]);
    expect(sanitized.suggestions).toEqual(["Acorta la entradilla."]);
  });

  it("recalcula el aprobado solo cuando el único bloqueo era una recomendación prohibida", () => {
    expect(
      sanitizeValidationReport({
        passed: false,
        issues: [
          {
            category: "seo",
            severity: "medium",
            description: "Faltan referencias visibles.",
            suggestion: "Añade enlaces a dos fuentes.",
          },
        ],
      }).passed,
    ).toBe(true);

    expect(sanitizeValidationReport({ passed: false, issues: [] }).passed).toBe(false);
  });

  it("rebaja inferencias confirmadas y eleva el riesgo factual de forma coherente", () => {
    const sanitized = sanitizeFactualReview({
      riskLevel: "low",
      claims: [
        {
          claim: "Microsoft confirmó que el paquete pesa 174 KB.",
          status: "confirmed",
          evidenceType: "inferred",
          sourceAuthority: "secondary",
          reason: "Un medio extrapola el tamaño desde la versión anterior.",
        },
      ],
      summary: "El dato necesita cautela.",
      researchSufficiency: { sufficient: true, reason: "Hay fuentes sobre el lanzamiento." },
    });

    expect(sanitized.claims[0].status).toBe("doubtful");
    expect(sanitized.riskLevel).toBe("medium");
  });

  it("fuerza feedback ai-tone cuando la métrica detecta párrafos uniformes", () => {
    const draft = Array.from({ length: 10 }, (_unused, index) =>
      Array.from({ length: 50 + (index % 2) }, (_word, word) => `p${index}-${word}`).join(" "),
    ).join("\n\n");
    const sanitized = sanitizeQualityReview(
      {
        structureScore: 90,
        factualSupportScore: 90,
        seoScore: 90,
        wordCount: 505,
        aiScore: 5,
        issues: [],
        suggestions: [],
      },
      { draft, aiScoreThreshold: 25 },
    );

    expect(sanitized.aiScore).toBe(25);
    expect(sanitized.issues).toEqual([
      expect.objectContaining({
        category: "ai-tone",
        description: expect.stringContaining("10 de 10"),
      }),
    ]);
  });
});
