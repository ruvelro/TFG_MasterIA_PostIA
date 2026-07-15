import { describe, expect, it } from "vitest";

import {
  buildArticlePreview,
  parseArticleEnrichment,
  parseArticleKeywords,
} from "@/lib/articles/preview";

const enrichment = {
  headlineVariants: ["Titular alternativo"],
  tags: ["energía", "tecnología"],
  faq: [{ question: "¿Qué cambia?", answer: "Cambia el coste." }],
  imageAlt: ["Paneles solares sobre una cubierta"],
  featuredImagePrompt: "Solar panels on a roof",
  aiDetection: { score: 12, label: "humano" },
  qualitySummary: {
    groundedness: 96,
    aiDetectionScore: 12,
    factualRisk: "low",
    qualityRisk: "low",
    warningsCount: 0,
    validationPassed: true,
  },
  jsonLdNewsArticle: { "@type": "NewsArticle" },
};

describe("vista publicada de artículos", () => {
  it("compone título, imagen, meta, tags, texto y FAQ sin exponer la ruta física", () => {
    const preview = buildArticlePreview({
      id: "article-1",
      title: "Energía solar en 2026",
      metaDescription: "Las claves del nuevo mercado solar.",
      keywords: JSON.stringify(["solar", "mercado"]),
      contentMarkdown: "## Costes\n\nEl precio ha bajado.",
      metadataJson: JSON.stringify(enrichment),
      featuredImagePath: "uploads/featured/private.png",
    });

    expect(preview).toMatchObject({
      id: "article-1",
      title: "Energía solar en 2026",
      metaDescription: "Las claves del nuevo mercado solar.",
      tags: ["energía", "tecnología"],
      contentMarkdown: "## Costes\n\nEl precio ha bajado.",
      faq: [{ question: "¿Qué cambia?", answer: "Cambia el coste." }],
      imageUrl: "/api/articles/article-1/image",
      imageAlt: "Paneles solares sobre una cubierta",
    });
    expect(JSON.stringify(preview)).not.toContain("private.png");
  });

  it("usa keywords y titular como fallback para artículos antiguos", () => {
    const preview = buildArticlePreview({
      id: "legacy",
      title: "Artículo antiguo",
      metaDescription: "Meta",
      keywords: JSON.stringify(["archivo"]),
      contentMarkdown: "Texto",
      metadataJson: "{incorrecto",
      featuredImagePath: null,
    });

    expect(preview.tags).toEqual(["archivo"]);
    expect(preview.faq).toEqual([]);
    expect(preview.imageUrl).toBeNull();
    expect(preview.imageAlt).toBe("Artículo antiguo");
  });

  it("tolera JSON inválido sin romper el historial", () => {
    expect(parseArticleKeywords("null")).toEqual([]);
    expect(parseArticleKeywords('["válida", 2]')).toEqual([]);
    expect(parseArticleEnrichment("[]")).toBeNull();
  });
});
