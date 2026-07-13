"use client";

import { useState } from "react";

import { ModelCombobox } from "@/components/model-combobox";

/**
 * Formulario cliente del generador de imágenes. Pide modelo (combobox con el catálogo de
 * OpenRouter), prompt y estilo (del catálogo configurable). Al generar, llama a la ruta interna
 * y muestra la imagen resultante como `data:` URI, con enlace de descarga. No persiste nada: es
 * una herramienta de creación puntual; el usuario descarga lo que le sirva.
 */

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

interface StyleOption {
  id: string;
  label: string;
}

interface GeneratedImage {
  dataUri: string;
  extension: string;
}

function extensionForMediaType(mediaType: string): string {
  if (mediaType.includes("jpeg")) return "jpg";
  if (mediaType.includes("webp")) return "webp";
  return "png";
}

export function ImagesClient({
  defaultModel,
  styles,
}: {
  defaultModel: string;
  styles: StyleOption[];
}) {
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState(styles[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<GeneratedImage | null>(null);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setImage(null);

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
      const data = (await response.json().catch(() => ({}))) as {
        imageBase64?: string;
        mediaType?: string;
        error?: string;
      };
      if (!response.ok || !data.imageBase64) {
        setError(data.error ?? "No se pudo generar la imagen.");
        return;
      }
      const mediaType = data.mediaType ?? "image/png";
      setImage({
        dataUri: `data:${mediaType};base64,${data.imageBase64}`,
        extension: extensionForMediaType(mediaType),
      });
    } catch {
      setError("Fallo de red al generar la imagen.");
    } finally {
      setStatus("idle");
    }
  }

  const generating = status === "generating";

  return (
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
        <select value={styleId} onChange={(e) => setStyleId(e.target.value)} className={inputClass}>
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

      {image ? (
        <figure className="border-muted/20 flex flex-col gap-3 rounded-lg border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI local, no procede next/image */}
          <img
            src={image.dataUri}
            alt="Imagen generada"
            className="max-h-[32rem] w-full rounded-md object-contain"
          />
          <a
            href={image.dataUri}
            download={`imagen-postia.${image.extension}`}
            className="border-muted/30 self-start rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            Descargar imagen
          </a>
        </figure>
      ) : null}
    </form>
  );
}
