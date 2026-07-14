import { describe, expect, it } from "vitest";

import {
  requestsVisibleSources,
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
          description: "Falta contexto en un porcentaje.",
          suggestion: "Incluye enlaces a las fuentes originales.",
        },
        {
          description: "La sede aparece dos veces.",
          suggestion: "Elimina la repetición.",
        },
      ],
      suggestions: ["Añade una bibliografía al final.", "Acorta la entradilla."],
    });

    expect(sanitized.issues).toEqual([
      {
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
});
