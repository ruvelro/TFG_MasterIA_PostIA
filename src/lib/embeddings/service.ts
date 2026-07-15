import { prisma } from "@/lib/db/client";
import { logError } from "@/lib/observability/error-log";
import { ArticleEnrichmentSchema } from "@/lib/pipeline/schemas";
import { getEmbeddingsModel } from "@/lib/settings/generation-config";
import { getOpenRouterApiKey } from "@/lib/settings/integrations";

import { embedTexts } from "./client";
import { cosineSimilarity } from "./similarity";

/**
 * Servicio de embeddings de artículos: deduplicación temática (avisar si un tema nuevo
 * solapa con un artículo previo del usuario) y enlazado interno (sugerir enlaces a
 * artículos relacionados tras cada generación).
 *
 * Todo el servicio es BEST-EFFORT: los embeddings son una mejora, no parte del contrato
 * de la generación. Si falta la clave, el modelo está desactivado o el endpoint falla,
 * las funciones degradan a "sin resultados" (con log) en lugar de romper la generación.
 */

/** Similitud mínima para considerar que dos piezas tratan el mismo tema. */
const SIMILARITY_THRESHOLD = 0.82;
/** Máximo de sugerencias de enlaces internos por artículo. */
const MAX_INTERNAL_LINKS = 3;

/** Texto que representa al artículo en el espacio de embeddings: lo esencial y barato. */
function articleText(article: { title: string; metaDescription: string }): string {
  return `${article.title}\n${article.metaDescription}`;
}

async function resolveEmbeddingContext(): Promise<{ apiKey: string; model: string } | null> {
  const [apiKey, model] = await Promise.all([getOpenRouterApiKey(), getEmbeddingsModel()]);
  if (!apiKey || !model) return null;
  return { apiKey, model };
}

export interface SimilarArticle {
  articleId: string;
  title: string;
  slug: string;
  similarity: number;
}

/**
 * Compara un vector con los embeddings guardados del usuario (solo los del mismo modelo:
 * vectores de modelos distintos no son comparables) y devuelve los más parecidos.
 */
async function findSimilarByVector(params: {
  userId: string;
  vector: number[];
  model: string;
  excludeArticleId?: string;
  minSimilarity: number;
  limit: number;
}): Promise<SimilarArticle[]> {
  const rows = await prisma.articleEmbedding.findMany({
    where: {
      model: params.model,
      articleId: params.excludeArticleId ? { not: params.excludeArticleId } : undefined,
      article: { userId: params.userId },
    },
    include: { article: { select: { id: true, title: true, slug: true } } },
  });

  return rows
    .map((row) => {
      let vector: number[] = [];
      try {
        vector = JSON.parse(row.vectorJson) as number[];
      } catch {
        // Vector corrupto: se ignora esa fila (se regenerará si el artículo se reindexa).
      }
      return {
        articleId: row.article.id,
        title: row.article.title,
        slug: row.article.slug,
        similarity: cosineSimilarity(params.vector, vector),
      };
    })
    .filter((candidate) => candidate.similarity >= params.minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, params.limit);
}

/**
 * Aviso de solape ANTES de generar: compara el tema propuesto con los artículos previos
 * del usuario. Devuelve [] si los embeddings no están operativos (nunca bloquea el flujo).
 */
export async function findSimilarArticlesForTopic(
  userId: string,
  topic: string,
): Promise<SimilarArticle[]> {
  try {
    const context = await resolveEmbeddingContext();
    if (!context) return [];

    const articles = await prisma.article.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        metaDescription: true,
        embedding: { select: { model: true } },
      },
    });
    const missingEmbeddings = articles.filter(
      (article) => article.embedding?.model !== context.model,
    );

    // El primer aviso tras activar o cambiar el modelo repara también el histórico. Se envían
    // tema y artículos en una sola petición para no multiplicar coste ni latencia.
    const [vector, ...articleVectors] = await embedTexts({
      ...context,
      texts: [topic, ...missingEmbeddings.map(articleText)],
    });
    if (missingEmbeddings.length > 0) {
      await prisma.$transaction(
        missingEmbeddings.map((article, index) =>
          prisma.articleEmbedding.upsert({
            where: { articleId: article.id },
            update: { model: context.model, vectorJson: JSON.stringify(articleVectors[index]) },
            create: {
              articleId: article.id,
              model: context.model,
              vectorJson: JSON.stringify(articleVectors[index]),
            },
          }),
        ),
      );
    }

    return await findSimilarByVector({
      userId,
      vector,
      model: context.model,
      minSimilarity: SIMILARITY_THRESHOLD,
      limit: 5,
    });
  } catch (error) {
    await logError({
      category: "pipeline",
      message: "No se pudo comprobar el solape temático (embeddings)",
      detail: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Tras cada generación: indexa el artículo nuevo y, si hay artículos previos relacionados,
 * añade las sugerencias de enlaces internos (con el título como texto ancla propuesto) al
 * enriquecimiento persistido. Best-effort y fuera del camino crítico de la generación.
 */
export async function indexArticleAndSuggestLinks(articleId: string): Promise<void> {
  try {
    const context = await resolveEmbeddingContext();
    if (!context) return;

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, userId: true, title: true, metaDescription: true, metadataJson: true },
    });
    if (!article) return;

    const [vector] = await embedTexts({ ...context, texts: [articleText(article)] });
    // Upsert: reindexar (p. ej. tras una revisión) sustituye el vector anterior.
    await prisma.articleEmbedding.upsert({
      where: { articleId: article.id },
      update: { model: context.model, vectorJson: JSON.stringify(vector) },
      create: { articleId: article.id, model: context.model, vectorJson: JSON.stringify(vector) },
    });

    const related = await findSimilarByVector({
      userId: article.userId,
      vector,
      model: context.model,
      excludeArticleId: article.id,
      // Para enlazar basta relación temática, no solape (umbral más laxo que el de dedupe).
      minSimilarity: 0.55,
      limit: MAX_INTERNAL_LINKS,
    });
    if (related.length === 0 || !article.metadataJson) return;

    const parsed = ArticleEnrichmentSchema.safeParse(JSON.parse(article.metadataJson));
    if (!parsed.success) return;

    const enrichment = {
      ...parsed.data,
      internalLinks: related.map((candidate) => ({
        articleId: candidate.articleId,
        title: candidate.title,
        slug: candidate.slug,
        // El título del artículo relacionado es el texto ancla propuesto.
        anchorText: candidate.title,
        similarity: Number(candidate.similarity.toFixed(3)),
      })),
    };
    await prisma.article.update({
      where: { id: article.id },
      data: { metadataJson: JSON.stringify(enrichment) },
    });
  } catch (error) {
    await logError({
      category: "pipeline",
      message: "No se pudo indexar el artículo para enlazado interno (embeddings)",
      detail: `articleId=${articleId}: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
