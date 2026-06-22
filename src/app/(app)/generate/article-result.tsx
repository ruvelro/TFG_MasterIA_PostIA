"use client";

import { Markdown } from "@/components/markdown";
import type { FixerOutput } from "@/lib/pipeline/schemas";

// Resultado final: artículo renderizado (Markdown saneado) y sus metadatos SEO, con
// acciones para copiar o descargar el contenido. El artículo ya quedó guardado en la BD.
export function ArticleResult({ article, onReset }: { article: FixerOutput; onReset: () => void }) {
  function copyMarkdown() {
    void navigator.clipboard.writeText(article.contentMarkdown);
  }

  function downloadMarkdown() {
    const blob = new Blob([article.contentMarkdown], { type: "text/markdown;charset=utf-8" });
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
        <div className="border-muted/20 text-muted flex flex-col gap-1 rounded-md border p-3 text-sm">
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

      <div className="flex gap-3">
        <button type="button" onClick={copyMarkdown} className={buttonClass}>
          Copiar Markdown
        </button>
        <button type="button" onClick={downloadMarkdown} className={buttonClass}>
          Descargar .md
        </button>
        <button type="button" onClick={onReset} className={buttonClass}>
          Nueva generación
        </button>
      </div>

      <div className="border-muted/20 rounded-lg border p-6">
        <Markdown>{article.contentMarkdown}</Markdown>
      </div>
    </article>
  );
}
