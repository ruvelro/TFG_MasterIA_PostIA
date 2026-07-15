"use client";

import Link from "next/link";

import { ArticleEnrichmentView } from "@/components/article-enrichment";
import { ArticlePreviewButton } from "@/components/article-preview";
import { Markdown } from "@/components/markdown";
import type { ArticleEnrichment, FixerOutput } from "@/lib/pipeline/schemas";
import { composeMarkdownDocument } from "@/lib/publish/markdown-document";

// Resultado final: artículo renderizado (Markdown saneado) y sus metadatos SEO, con
// acciones para copiar o descargar el contenido. El artículo ya quedó guardado en la BD.
export function ArticleResult({
  article,
  enrichment,
  articleId,
  hasFeaturedImage,
  onReset,
}: {
  article: FixerOutput;
  enrichment: ArticleEnrichment | null;
  articleId: string | null;
  hasFeaturedImage: boolean;
  onReset: () => void;
}) {
  const markdownDocument = composeMarkdownDocument(article.title, article.contentMarkdown);

  function copyMarkdown() {
    void navigator.clipboard.writeText(markdownDocument);
  }

  function downloadMarkdown() {
    const blob = new Blob([markdownDocument], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${article.slug || "articulo"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const buttonClass = "border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium";

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="border-muted/15 hover:border-primary/40 bg-foreground/[0.02] text-muted flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors">
          <p>
            <span className="font-medium">Slug:</span> {article.slug}
          </p>
          <p>
            <span className="font-medium">Meta description:</span> {article.metaDescription}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Keywords:</span>
            {article.keywords.map((keyword) => (
              <span
                key={keyword}
                className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copyMarkdown} className={buttonClass}>
          Copiar Markdown
        </button>
        <button type="button" onClick={downloadMarkdown} className={buttonClass}>
          Descargar .md
        </button>
        {articleId ? <ArticlePreviewButton articleId={articleId} className={buttonClass} /> : null}
        <button type="button" onClick={onReset} className={buttonClass}>
          Nueva generación
        </button>
        {articleId ? (
          <Link href={`/articles/${articleId}`} className={buttonClass}>
            Ver en historial
          </Link>
        ) : null}
      </div>

      {hasFeaturedImage && articleId ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida con autorización
        <img
          src={`/api/articles/${articleId}/image`}
          alt={enrichment?.imageAlt[0] ?? article.title}
          className="border-muted/15 aspect-video w-full rounded-lg border object-cover"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}

      {enrichment ? <ArticleEnrichmentView enrichment={enrichment} /> : null}

      <div className="border-muted/15 bg-foreground/[0.02] rounded-lg border p-6">
        <Markdown>{article.contentMarkdown}</Markdown>
      </div>
    </article>
  );
}
