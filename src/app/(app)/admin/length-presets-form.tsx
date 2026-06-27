"use client";

import { useState } from "react";

import type { LengthPreset } from "@/lib/pipeline/schemas";

import { saveLengthPresets } from "./actions";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

function emptyPreset(index: number): LengthPreset {
  return { id: `longitud-${index}`, label: "Nuevo preset", minWords: 500, maxWords: 800 };
}

/** CRUD del catálogo de presets de longitud. El usuario elige uno al generar. */
export function LengthPresetsForm({ initialPresets }: { initialPresets: LengthPreset[] }) {
  const [presets, setPresets] = useState<LengthPreset[]>(initialPresets);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function patch(index: number, change: Partial<LengthPreset>) {
    setPresets((prev) => prev.map((p, i) => (i === index ? { ...p, ...change } : p)));
  }

  async function save() {
    setStatus("saving");
    setMessage(null);
    try {
      await saveLengthPresets(presets);
      setMessage("Presets de longitud guardados.");
    } catch {
      setMessage("No se pudieron guardar (revisa ids únicos y que el máximo ≥ el mínimo).");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Presets de longitud</h2>
        <p className="text-muted text-sm">
          Rangos de palabras que el usuario elige al generar. Tienen prioridad sobre la longitud
          objetivo del tipo de noticia.
        </p>
      </div>

      {message ? <p className="text-muted text-sm">{message}</p> : null}

      {presets.map((preset, index) => (
        <fieldset key={index} className="border-muted/20 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold">{preset.label || "(sin nombre)"}</legend>
            <button
              type="button"
              onClick={() => setPresets((prev) => prev.filter((_, i) => i !== index))}
              className="text-xs font-medium text-red-600"
            >
              Eliminar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nombre</span>
              <input
                value={preset.label}
                onChange={(e) => patch(index, { label: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Identificador (minúsculas, guiones)</span>
              <input
                value={preset.id}
                onChange={(e) => patch(index, { id: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Palabras mínimas</span>
              <input
                type="number"
                min={0}
                max={20000}
                value={preset.minWords}
                onChange={(e) => patch(index, { minWords: Number(e.target.value) || 0 })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Palabras máximas</span>
              <input
                type="number"
                min={1}
                max={20000}
                value={preset.maxWords}
                onChange={(e) => patch(index, { maxWords: Number(e.target.value) || 0 })}
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPresets((prev) => [...prev, emptyPreset(prev.length + 1)])}
          className="border-muted/30 rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir preset
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "saving" ? "Guardando…" : "Guardar presets"}
        </button>
      </div>
    </section>
  );
}
