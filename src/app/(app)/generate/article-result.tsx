"use client";

import Link from "next/link";

import { Markdown } from "@/components/markdown";
import type { ArticleEnrichment, FixerOutput } from "@/lib/pipeline/schemas";

// Resultado final: artículo renderizado (Markdown saneado) y sus metadatos SEO, con
// acciones para copiar o descargar el contenido. El artículo ya quedó guardado en la BD.
export function ArticleResult({
  article,
  enrichment,
  articleId,
  onReset,
}: {
  article: FixerOutput;
  enrichment: ArticleEnrichment | null;
  articleId: string | null;
  onReset: () => void;
}) {
  function copyMarkdown() {
    void navigator.clipboard.writeText(article.contentMarkdown);
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
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
  const sectionClass = "border-muted/20 rounded-lg border p-4 flex flex-col gap-3";

  const aiLabel = enrichment?.aiDetection.label;
  const aiLabelColor =
    aiLabel === "humano"
      ? "bg-green-100 text-green-800"
      : aiLabel === "mixto"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

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
        {articleId ? (
          <Link href={`/articles/${articleId}`} className={buttonClass}>
            Ver en historial
          </Link>
        ) : null}
      </div>

      {enrichment ? (
        <section className="flex flex-col gap-4">
          {/* Panel de métricas derivadas */}
          <div className={sectionClass}>
            <h2 className="text-sm font-semibold tracking-wide uppercase">Métricas de calidad</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${aiLabelColor}`}>
                {enrichment.aiDetection.label} · {enrichment.aiDetection.score}% IA
              </span>
              <span className="text-muted">
                Anclaje factual: <strong>{enrichment.qualitySummary.groundedness}%</strong>
              </span>
              <span className="text-muted">
                Riesgo factual:{" "}
                <strong className="capitalize">{enrichment.qualitySummary.factualRisk}</strong>
              </span>
              <span className="text-muted">
                Riesgo calidad:{" "}
                <strong className="capitalize">{enrichment.qualitySummary.qualityRisk}</strong>
              </span>
              <span className="text-muted">
                Avisos: <strong>{enrichment.qualitySummary.warningsCount}</strong>
              </span>
            </div>
          </div>

          {/* Titulares alternativos */}
          {enrichment.headlineVariants.length > 0 && (
            <details className={sectionClass}>
              <summary className="cursor-pointer text-sm font-semibold">
                Titulares alternativos ({enrichment.headlineVariants.length})
              </summary>
              <ol className="text-muted mt-2 flex flex-col gap-1 pl-5 text-sm">
                {enrichment.headlineVariants.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </details>
          )}

          {/* Tags */}
          {enrichment.tags.length > 0 && (
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold">Etiquetas</h2>
              <div className="flex flex-wrap gap-2">
                {enrichment.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted/20 text-muted rounded-full px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          {enrichment.faq.length > 0 && (
            <details className={sectionClass}>
              <summary className="cursor-pointer text-sm font-semibold">
                FAQ ({enrichment.faq.length} preguntas)
              </summary>
              <dl className="mt-2 flex flex-col gap-3 text-sm">
                {enrichment.faq.map((item, i) => (
                  <div key={i}>
                    <dt className="font-medium">{item.question}</dt>
                    <dd className="text-muted mt-0.5">{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          {/* Alt de imagen */}
          {enrichment.imageAlt.length > 0 && (
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold">Texto alt para imagen destacada</h2>
              <ul className="text-muted flex flex-col gap-1 text-sm">
                {enrichment.imageAlt.map((alt, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>{alt}</span>
                    <button
                      type="button"
                      onClick={() => copyText(alt)}
                      className="text-muted hover:text-foreground shrink-0 text-xs"
                    >
                      Copiar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prompt de imagen */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Prompt para imagen destacada</h2>
              <button
                type="button"
                onClick={() => copyText(enrichment.featuredImagePrompt)}
                className="text-muted hover:text-foreground text-xs"
              >
                Copiar
              </button>
            </div>
            <p className="text-muted text-sm italic">{enrichment.featuredImagePrompt}</p>
          </div>

          {/* JSON-LD */}
          <details className={sectionClass}>
            <summary className="cursor-pointer text-sm font-semibold">
              JSON-LD (Schema.org NewsArticle)
            </summary>
            <div className="mt-2 flex items-start justify-between gap-2">
              <pre className="bg-muted/10 text-muted flex-1 overflow-x-auto rounded p-3 text-xs">
                {JSON.stringify(enrichment.jsonLdNewsArticle, null, 2)}
              </pre>
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(enrichment.jsonLdNewsArticle, null, 2))}
                className="text-muted hover:text-foreground shrink-0 text-xs"
              >
                Copiar
              </button>
            </div>
          </details>
        </section>
      ) : null}

      <div className="border-muted/20 rounded-lg border p-6">
        <Markdown>{article.contentMarkdown}</Markdown>
      </div>
    </article>
  );
}
