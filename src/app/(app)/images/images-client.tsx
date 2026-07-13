"use client";

import { useState } from "react";

import { ModelCombobox } from "@/components/model-combobox";

import { ImageCard, type ArticleOption, type GalleryImage } from "./image-card";

/**
 * Formulario del generador de imágenes y galería del usuario. Al generar, llama a la ruta interna
 * (que persiste la imagen) y antepone la nueva a la galería. Las imágenes se sirven por su ruta
 * con verificación de propiedad; la galería inicial llega renderizada desde el servidor.
 */

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

interface StyleOption {
  id: string;
  label: string;
}

export function ImagesClient({
  defaultModel,
  styles,
  articles,
  initialImages,
}: {
  defaultModel: string;
  styles: StyleOption[];
  articles: ArticleOption[];
  initialImages: GalleryImage[];
}) {
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState(styles[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GalleryImage[]>(initialImages);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const model = String(formData.get("model") ?? "").trim();
    if (!model) {
      setError("Elige un modelo de imagen.");
      return;
    }
    if (!prompt.trim()) {
      setError("Describe la imagen que quieres generar.");
      return;
    }

    setStatus("generating");
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: prompt.trim(), styleId: styleId || undefined }),
      });
      const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error ?? "No se pudo generar la imagen.");
        return;
      }
      // La nueva imagen encabeza la galería; se sirve por su ruta (ya persistida en el servidor).
      setImages((prev) => [
        { id: data.id!, prompt: prompt.trim(), styleId: styleId || null, model },
        ...prev,
      ]);
    } catch {
      setError("Fallo de red al generar la imagen.");
    } finally {
      setStatus("idle");
    }
  }

  const generating = status === "generating";

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={generate} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Modelo de imagen (OpenRouter)</span>
          <ModelCombobox name="model" defaultValue={defaultModel} className={inputClass} />
          <span className="text-muted text-xs">
            Debe ser un modelo capaz de generar imágenes (p. ej. google/gemini-2.5-flash-image).
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Descripción (prompt)</span>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="p. ej. Panel solar en un tejado al atardecer, cielo despejado"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estilo</span>
          <select
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            className={inputClass}
          >
            {styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
          <span className="text-muted text-xs">
            Los estilos añaden un matiz estético al prompt. Se editan en Administración.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={generating}
            className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {generating ? "Generando…" : "Generar imagen"}
          </button>
          {error ? (
            <span className="text-sm text-red-600" role="status">
              {error}
            </span>
          ) : null}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Galería</h2>
        {images.length === 0 ? (
          <p className="text-muted text-sm">
            Aún no has generado imágenes. Las que crees aparecerán aquí para reutilizarlas.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                articles={articles}
                onDeleted={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
