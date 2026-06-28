import {
  BlueprintSchema,
  EnrichStepOutputSchema,
  FactualReviewSchema,
  FactsSchema,
  FixerOutputSchema,
  QualityReviewSchema,
  ValidationReportSchema,
} from "@/lib/pipeline/schemas";
import type { PipelineDeps } from "@/lib/pipeline/types";

/**
 * Dependencias FALSAS y deterministas del pipeline, SOLO para los tests e2e (cuando
 * `E2E=true`). Permiten ejercitar el flujo completo de la UI —progreso, revisión y
 * resultado— sin claves de API ni red. No se usan en producción.
 *
 * `runObject` decide la respuesta por identidad del esquema (los steps pasan exactamente
 * estos objetos), evitando depender del orden de las llamadas.
 */
export function createFakePipelineDeps(): PipelineDeps {
  const runObject: PipelineDeps["runObject"] = async ({ schema }) => {
    const s = schema as unknown;
    let object: unknown;

    if (s === FactsSchema) {
      object = {
        facts: [{ claim: "Dato de ejemplo generado en modo E2E", source: "https://example.com/0" }],
      };
    } else if (s === BlueprintSchema) {
      object = {
        title: "Artículo de ejemplo",
        angle: "Informativo",
        targetKeyword: "ejemplo",
        sections: [{ heading: "Introducción", summary: "Contexto del tema" }],
      };
    } else if (s === ValidationReportSchema) {
      object = { passed: true, issues: [] };
    } else if (s === FactualReviewSchema) {
      object = {
        riskLevel: "low",
        claims: [
          { claim: "Dato de ejemplo", status: "confirmed", reason: "Presente en las fuentes" },
        ],
        summary: "Revisión factual sin riesgos (E2E).",
        researchSufficiency: {
          sufficient: true,
          reason: "Las fuentes cubren el tema adecuadamente.",
        },
      };
    } else if (s === QualityReviewSchema) {
      object = {
        structureScore: 85,
        factualSupportScore: 90,
        seoScore: 80,
        wordCount: 350,
        aiScore: 30,
        issues: [],
        suggestions: [],
      };
    } else if (s === EnrichStepOutputSchema) {
      object = {
        headlineVariants: ["Titular alternativo E2E"],
        tags: ["ejemplo", "e2e", "test"],
        faq: [
          { question: "¿Qué es esto?", answer: "Un artículo de ejemplo generado en modo E2E." },
        ],
        imageAlt: ["Ilustración de ejemplo para el artículo E2E"],
        jsonLdNewsArticle: {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: "Artículo de ejemplo",
          datePublished: new Date().toISOString().slice(0, 10),
        },
        featuredImagePrompt:
          "A clean illustration representing an example article in E2E test mode.",
      };
    } else if (s === FixerOutputSchema) {
      object = {
        contentMarkdown: "## Resumen\n\nContenido **generado** en modo E2E.",
        title: "Artículo de ejemplo",
        slug: "articulo-de-ejemplo",
        metaDescription: "Meta description de ejemplo para el modo E2E.",
        keywords: ["ejemplo", "e2e"],
      };
    } else {
      throw new Error("esquema inesperado en las dependencias falsas");
    }

    return { object: object as never, usage: {} };
  };

  return {
    search: async (_query, limit) =>
      Array.from({ length: limit }, (_unused, index) => ({
        title: `Fuente de ejemplo ${index}`,
        url: `https://example.com/${index}`,
        snippet: `Extracto de ejemplo ${index}`,
      })),
    fetchContent: async (url) => `Contenido simulado descargado de ${url}.`,
    runText: async () => ({
      text: "# Borrador de ejemplo\n\nTexto del borrador (E2E).",
      usage: {},
    }),
    runObject,
    // En e2e no consultamos precios reales: el coste no es el objeto de la prueba.
    estimateCost: async () => null,
  };
}
