"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Markdown } from "@/components/markdown";
import type { ArticlePreviewPayload } from "@/lib/articles/preview";

function ArticlePreviewDialog({
  article,
  loading,
  error,
  onClose,
  onRetry,
}: {
  article: ArticlePreviewPayload | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="border-muted/25 bg-background text-foreground fixed inset-0 m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl overflow-hidden rounded-lg border p-0 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="border-muted/20 bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <h2 id={titleId} className="text-sm font-semibold">
            Vista previa del artículo
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar vista previa"
            className="hover:bg-foreground/10 flex size-9 items-center justify-center rounded-md text-2xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto">
          {loading ? (
            <div className="text-muted flex min-h-64 items-center justify-center px-6 text-sm">
              Cargando vista previa…
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center">
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Reintentar
              </button>
            </div>
          ) : article ? (
            <article className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
              <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{article.title}</h1>

              {article.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida con autorización
                <img
                  src={article.imageUrl}
                  alt={article.imageAlt}
                  className="border-muted/20 mt-7 aspect-video w-full rounded-lg border object-cover"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              ) : null}

              {article.metaDescription ? (
                <p className="text-muted mt-6 border-l-2 border-emerald-500 pl-4 text-lg leading-relaxed">
                  {article.metaDescription}
                </p>
              ) : null}

              {article.tags.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2" aria-label="Etiquetas">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border-muted/25 bg-foreground/[0.04] rounded-full border px-2.5 py-1 text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="border-muted/20 mt-9 border-t pt-5">
                <Markdown>{article.contentMarkdown}</Markdown>
              </div>

              {article.faq.length > 0 ? (
                <section className="border-muted/20 mt-10 border-t pt-8">
                  <h2 className="text-2xl font-semibold">Preguntas frecuentes</h2>
                  <div className="mt-4">
                    {article.faq.map((item) => (
                      <div
                        key={item.question}
                        className="border-muted/20 border-t py-5 first:border-0"
                      >
                        <h3 className="font-semibold">{item.question}</h3>
                        <p className="text-muted mt-2 leading-relaxed">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

export function ArticlePreviewButton({
  articleId,
  className = "border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium",
}: {
  articleId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<ArticlePreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadArticle() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/articles/${articleId}/preview`, { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      setArticle((await response.json()) as ArticlePreviewPayload);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message ? cause.message : "No se pudo cargar el artículo.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openPreview() {
    setOpen(true);
    if (!article && !loading) void loadArticle();
  }

  return (
    <>
      <button type="button" onClick={openPreview} aria-haspopup="dialog" className={className}>
        Vista publicada
      </button>
      {open ? (
        <ArticlePreviewDialog
          article={article}
          loading={loading}
          error={error}
          onRetry={() => void loadArticle()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
