import { ArticleEnrichmentSchema, type ArticleEnrichment } from "@/lib/pipeline/schemas";

export interface ArticlePreviewSource {
  id: string;
  title: string;
  metaDescription: string;
  keywords: string;
  contentMarkdown: string;
  metadataJson: string | null;
  featuredImagePath: string | null;
}

export interface ArticlePreviewPayload {
  id: string;
  title: string;
  metaDescription: string;
  tags: string[];
  contentMarkdown: string;
  faq: ArticleEnrichment["faq"];
  imageUrl: string | null;
  imageAlt: string;
}

export function parseArticleKeywords(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function parseArticleEnrichment(raw: string | null): ArticleEnrichment | null {
  if (!raw) return null;
  try {
    const result = ArticleEnrichmentSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Construye la vista pública sin exponer la ruta privada del fichero destacado. */
export function buildArticlePreview(article: ArticlePreviewSource): ArticlePreviewPayload {
  const enrichment = parseArticleEnrichment(article.metadataJson);
  const keywords = parseArticleKeywords(article.keywords);
  const tags = enrichment?.tags.length ? enrichment.tags : keywords;

  return {
    id: article.id,
    title: article.title,
    metaDescription: article.metaDescription,
    tags,
    contentMarkdown: article.contentMarkdown,
    faq: enrichment?.faq ?? [],
    imageUrl: article.featuredImagePath ? `/api/articles/${article.id}/image` : null,
    imageAlt: enrichment?.imageAlt[0] ?? article.title,
  };
}
