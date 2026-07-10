"use client";

import { useState } from "react";

/**
 * Acciones de salida de un artículo: exportarlo (Markdown/HTML) y publicarlo en WordPress.
 * La publicación llama al endpoint del servidor; el resultado (enlace al post) o el error
 * se muestran en línea. Si WordPress no está configurado, solo se ofrece la exportación.
 */
export function PublishPanel({
  articleId,
  wordpressConfigured,
}: {
  articleId: string;
  wordpressConfigured: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "publishing">("idle");
  const [asDraft, setAsDraft] = useState(true);
  const [result, setResult] = useState<{ link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setStatus("publishing");
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/articles/${articleId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: asDraft ? "draft" : "publish" }),
      });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      setResult((await response.json()) as { link: string });
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="border-muted/15 bg-foreground/[0.02] flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Exportar y publicar</h2>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a
          href={`/api/articles/${articleId}/export?format=md`}
          className="border-muted/30 rounded-md border px-3 py-1.5 font-medium"
        >
          Descargar Markdown
        </a>
        <a
          href={`/api/articles/${articleId}/export?format=html`}
          className="border-muted/30 rounded-md border px-3 py-1.5 font-medium"
        >
          Descargar HTML
        </a>

        {wordpressConfigured ? (
          <>
            <span className="border-muted/20 h-5 border-l" aria-hidden />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asDraft}
                onChange={(e) => setAsDraft(e.target.checked)}
              />
              <span>Como borrador</span>
            </label>
            <button
              type="button"
              onClick={publish}
              disabled={status === "publishing"}
              className="bg-primary rounded-md px-3 py-1.5 font-medium text-white disabled:opacity-60"
            >
              {status === "publishing" ? "Publicando…" : "Publicar en WordPress"}
            </button>
          </>
        ) : (
          <span className="text-muted">
            (WordPress no configurado: un administrador puede activarlo en el panel)
          </span>
        )}
      </div>

      {result ? (
        <p className="text-sm text-green-700">
          Publicado.{" "}
          <a href={result.link} target="_blank" rel="noreferrer" className="text-primary underline">
            Ver el post en WordPress
          </a>
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
    </section>
  );
}
