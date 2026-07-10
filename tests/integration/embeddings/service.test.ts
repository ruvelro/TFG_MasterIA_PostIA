import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/client";
import { findSimilarArticlesForTopic, indexArticleAndSuggestLinks } from "@/lib/embeddings/service";
import { setAppSetting } from "@/lib/settings/app-config";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/settings/keys";
import { setSecret } from "@/lib/settings/secrets";

/**
 * El servicio de embeddings se prueba con el endpoint de OpenRouter simulado: un "espacio"
 * determinista donde el vector depende del texto, para poder controlar las similitudes.
 * La clave se guarda cifrada en la BD de test (misma infraestructura que producción).
 */

// Vectores por tema: "solar" y "fotovoltaica" son casi iguales; "cocina" es ortogonal.
function vectorFor(text: string): number[] {
  const t = text.toLowerCase();
  if (t.includes("fotovoltaica")) return [0.99, 0.1, 0];
  if (t.includes("solar")) return [1, 0, 0];
  if (t.includes("cocina")) return [0, 1, 0];
  return [0, 0, 1];
}

function stubEmbeddingsFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return new Response(
        JSON.stringify({ data: body.input.map((text) => ({ embedding: vectorFor(text) })) }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
}

let userId: string;

async function createArticle(title: string, metadataJson: string | null = null): Promise<string> {
  const article = await prisma.article.create({
    data: {
      userId,
      title,
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      contentMarkdown: `# ${title}`,
      metaDescription: title,
      metadataJson,
    },
    select: { id: true },
  });
  return article.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Embeddings", email: `emb_${Date.now()}@postia.test` },
  });
  userId = user.id;
  await setSecret(SECRET_KEYS.openRouter, "sk-or-test");
  await setAppSetting(SETTING_KEYS.embeddingsModel, "openai/text-embedding-3-small");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("servicio de embeddings", () => {
  it("indexa un artículo y detecta el solape con un tema parecido", async () => {
    stubEmbeddingsFetch();
    const articleId = await createArticle("Tendencias de energía solar");
    await indexArticleAndSuggestLinks(articleId);

    const stored = await prisma.articleEmbedding.findUnique({ where: { articleId } });
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!.vectorJson)).toEqual([1, 0, 0]);

    // Un tema casi idéntico dispara el aviso; uno ortogonal, no.
    const similar = await findSimilarArticlesForTopic(userId, "Nueva planta fotovoltaica");
    expect(similar.map((s) => s.articleId)).toContain(articleId);
    const unrelated = await findSimilarArticlesForTopic(userId, "Recetas de cocina vasca");
    expect(unrelated).toEqual([]);
  });

  it("añade sugerencias de enlaces internos al enriquecimiento del artículo nuevo", async () => {
    stubEmbeddingsFetch();
    // Artículo previo ya indexado sobre el mismo tema.
    const previousId = await createArticle("Guía de energía solar doméstica");
    await indexArticleAndSuggestLinks(previousId);

    const enrichment = {
      headlineVariants: ["t"],
      tags: ["solar"],
      faq: [],
      imageAlt: ["alt"],
      jsonLdNewsArticle: { "@type": "NewsArticle" },
      featuredImagePrompt: "solar panels",
      aiDetection: { score: 10, label: "humano" },
      qualitySummary: {
        groundedness: 100,
        aiDetectionScore: 10,
        factualRisk: "low",
        qualityRisk: "low",
        warningsCount: 0,
        validationPassed: true,
      },
    };
    const newId = await createArticle(
      "Placas solares fotovoltaica 2026",
      JSON.stringify(enrichment),
    );
    await indexArticleAndSuggestLinks(newId);

    const updated = await prisma.article.findUniqueOrThrow({ where: { id: newId } });
    const metadata = JSON.parse(updated.metadataJson!) as {
      internalLinks?: { articleId: string; anchorText: string }[];
    };
    const link = metadata.internalLinks?.find((l) => l.articleId === previousId);
    expect(link).toBeDefined();
    // El texto ancla propuesto es el título del artículo relacionado.
    expect(link?.anchorText).toBe("Guía de energía solar doméstica");
  });

  it("degrada a 'sin resultados' si el endpoint de embeddings falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const similar = await findSimilarArticlesForTopic(userId, "Tema cualquiera con fallo");
    expect(similar).toEqual([]);
  });

  it("con la función desactivada (modelo vacío) no llama a la red", async () => {
    await setAppSetting(SETTING_KEYS.embeddingsModel, "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const similar = await findSimilarArticlesForTopic(userId, "Tema con embeddings apagados");
    expect(similar).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await setAppSetting(SETTING_KEYS.embeddingsModel, "openai/text-embedding-3-small");
  });
});
