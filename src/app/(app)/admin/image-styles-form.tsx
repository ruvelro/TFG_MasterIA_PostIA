"use client";

import { useState } from "react";

import { CollapsibleEditor } from "@/components/collapsible-editor";
import type { ImageStyle } from "@/lib/pipeline/schemas";

import { saveImageStyles } from "./actions";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

function emptyStyle(index: number): ImageStyle {
  return { id: `estilo-${index}`, label: "Nuevo estilo", promptSuffix: "" };
}

/**
 * CRUD del catálogo de estilos del generador de imágenes. Cada estilo aporta un `promptSuffix`
 * que se añade al prompt del usuario para inducir una estética concreta. El primero suele ser
 * "Sin estilo" (sufijo vacío). El usuario elige uno en la página de generación de imágenes.
 */
export function ImageStylesForm({ initialStyles }: { initialStyles: ImageStyle[] }) {
  const [styles, setStyles] = useState<ImageStyle[]>(initialStyles);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function patch(index: number, change: Partial<ImageStyle>) {
    setStyles((prev) => prev.map((s, i) => (i === index ? { ...s, ...change } : s)));
  }

  async function save() {
    setStatus("saving");
    setMessage(null);
    try {
      await saveImageStyles(styles);
      setMessage("Estilos de imagen guardados.");
    } catch {
      setMessage("No se pudieron guardar (revisa que los identificadores sean únicos y válidos).");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Estilos de imagen</h2>
        <p className="text-muted text-sm">
          Modificadores estéticos para el generador de imágenes. El sufijo (mejor en inglés) se
          añade al prompt del usuario. Deja el sufijo vacío para un estilo neutro.
        </p>
      </div>

      {message ? <p className="text-muted text-sm">{message}</p> : null}

      {styles.map((style, index) => (
        <CollapsibleEditor
          key={index}
          title={style.label || "(sin nombre)"}
          description={style.promptSuffix || "Sin modificador estético"}
        >
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStyles((prev) => prev.filter((_, i) => i !== index))}
                className="text-xs font-medium text-red-600"
              >
                Eliminar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Nombre</span>
                <input
                  value={style.label}
                  onChange={(e) => patch(index, { label: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Identificador (minúsculas, guiones)</span>
                <input
                  value={style.id}
                  onChange={(e) => patch(index, { id: e.target.value })}
                  className={`${inputClass} font-mono`}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Sufijo de prompt (estética)</span>
              <textarea
                rows={2}
                value={style.promptSuffix}
                onChange={(e) => patch(index, { promptSuffix: e.target.value })}
                placeholder="p. ej. editorial photojournalism, natural lighting, no text"
                className={inputClass}
              />
            </label>
          </div>
        </CollapsibleEditor>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStyles((prev) => [...prev, emptyStyle(prev.length + 1)])}
          className="border-muted/30 rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir estilo
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "saving" ? "Guardando…" : "Guardar estilos"}
        </button>
      </div>
    </section>
  );
}
