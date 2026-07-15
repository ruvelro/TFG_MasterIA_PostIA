import {
  ArticleMetadataSchema,
  BlueprintSchema,
  EnrichStepOutputSchema,
  FactualReviewSchema,
  FactsSchema,
  QueryExpansionSchema,
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

    if (s === QueryExpansionSchema) {
      object = { queries: ["consulta complementaria E2E"] };
    } else if (s === FactsSchema) {
      object = {
        facts: [{ claim: "Dato de ejemplo generado en modo E2E", source: "https://example.com/0" }],
      };
    } else if (s === BlueprintSchema) {
      object = {
        title: "Artículo de ejemplo",
        angle: "Informativo",
        readerPromise: "Entender el dato principal del ejemplo.",
        mainThesis: "El ejemplo resume el funcionamiento del flujo E2E.",
        leadAngle: "El pipeline generó contenido simulado correctamente.",
        excludeOrCompress: ["Detalles técnicos secundarios"],
        targetKeyword: "ejemplo",
        sections: [{ heading: "Introducción", summary: "Contexto del tema" }],
      };
    } else if (s === ValidationReportSchema) {
      object = { passed: true, issues: [] };
    } else if (s === FactualReviewSchema) {
      object = {
        riskLevel: "low",
        claims: [
          {
            claim: "Dato de ejemplo",
            status: "confirmed",
            evidenceType: "direct",
            sourceAuthority: "primary",
            reason: "Presente en las fuentes",
          },
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
        aiScore: 20,
        issues: [],
        suggestions: [],
      };
    } else if (s === ArticleMetadataSchema) {
      object = {
        title: "Artículo de ejemplo",
        slug: "articulo-de-ejemplo",
        metaDescription: "Meta description de ejemplo para el modo E2E.",
        keywords: ["ejemplo", "e2e"],
      };
    } else if (s === EnrichStepOutputSchema) {
      object = {
        headlineVariants: ["Titular alternativo E2E"],
        tags: ["ejemplo", "e2e", "test"],
        faq: [
          { question: "¿Qué es esto?", answer: "Un artículo de ejemplo generado en modo E2E." },
        ],
        imageAlt: ["Ilustración de ejemplo para el artículo E2E"],
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
    search: async (query, limit) => {
      // Cada consulta simula un proveedor distinto para que el límite por dominio no haga
      // desaparecer el fallback literal antes de evaluar su relevancia.
      const queryKey = Buffer.from(query).toString("hex").slice(0, 24) || "empty";
      return Array.from({ length: limit }, (_unused, index) => ({
        title: `${query}: fuente de ejemplo ${index}`,
        url: `https://query-${queryKey}.example/${index}`,
        snippet: `Información sobre ${query}, extracto de ejemplo ${index}`,
      }));
    },
    fetchContent: async (url) => `Contenido simulado descargado de ${url}.`,
    runText: async () => ({
      text: "# Borrador de ejemplo\n\nTexto del borrador (E2E).",
      usage: {},
    }),
    runObject,
    // Imagen falsa determinista (PNG de 1x1) sin red; el almacenamiento no toca disco.
    runImage: async () => ({
      imageBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      mediaType: "image/png",
      usage: {},
    }),
    storeImage: async ({ runId }) => `uploads/featured/${runId}.png`,
    // En e2e no consultamos precios reales: el coste no es el objeto de la prueba.
    estimateCost: async () => null,
  };
}
