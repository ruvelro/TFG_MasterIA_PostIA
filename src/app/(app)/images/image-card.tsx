"use client";

import { useState } from "react";

export interface GalleryImage {
  id: string;
  prompt: string;
  styleId: string | null;
  model: string;
}

export interface ArticleOption {
  id: string;
  title: string;
}

/**
 * Tarjeta de una imagen de la galería. Muestra la imagen (servida por la ruta con verificación
 * de propiedad), permite asignarla como destacada de un artículo del usuario (feature 4) y
 * eliminarla. Gestiona su propio estado local para no re-renderizar toda la galería en cada acción.
 */
export function ImageCard({
  image,
  articles,
  onDeleted,
}: {
  image: GalleryImage;
  articles: ArticleOption[];
  onDeleted: (id: string) => void;
}) {
  const [articleId, setArticleId] = useState(articles[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "assigning" | "deleting">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function assignFeatured() {
    if (!articleId) return;
    setStatus("assigning");
    setMessage(null);
    try {
      const res = await fetch(`/api/images/${image.id}/set-featured`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      setMessage(res.ok ? "Asignada como destacada ✓" : "No se pudo asignar");
    } catch {
      setMessage("Fallo de red");
    } finally {
      setStatus("idle");
    }
  }

  async function remove() {
    setStatus("deleting");
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(image.id);
      else setMessage("No se pudo eliminar");
    } catch {
      setMessage("Fallo de red");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <figure className="border-muted/20 flex flex-col gap-2 rounded-lg border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- servida por ruta propia con auth, no procede next/image */}
      <img
        src={`/api/images/${image.id}`}
        alt={image.prompt}
        loading="lazy"
        className="aspect-square w-full rounded-md object-cover"
      />
      <figcaption className="text-muted line-clamp-2 text-xs" title={image.prompt}>
        {image.prompt}
      </figcaption>

      {articles.length > 0 ? (
        <div className="flex flex-col gap-1">
          <select
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
            aria-label="Artículo destino"
            className="border-muted/30 focus:border-primary w-full rounded-md border px-2 py-1 text-xs outline-none"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={assignFeatured}
            disabled={status !== "idle"}
            className="border-muted/30 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
          >
            {status === "assigning" ? "Asignando…" : "Usar como destacada"}
          </button>
        </div>
      ) : (
        <span className="text-muted text-xs">Aún no tienes artículos donde usarla.</span>
      )}

      <div className="flex items-center justify-between gap-2">
        {message ? <span className="text-muted text-xs">{message}</span> : <span />}
        <button
          type="button"
          onClick={remove}
          disabled={status !== "idle"}
          className="text-xs font-medium text-red-600 disabled:opacity-60"
        >
          {status === "deleting" ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </figure>
  );
}
