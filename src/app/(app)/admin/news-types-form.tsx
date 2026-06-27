"use client";

import { useState } from "react";

import type { NewsType } from "@/lib/pipeline/schemas";

import { saveNewsTypes } from "./actions";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

function emptyType(index: number): NewsType {
  return {
    id: `tipo-${index}`,
    label: "Nuevo tipo",
    description: "",
    enableHumanize: true,
    enableFactualReview: true,
    enableQualityReview: true,
    sourceStrict: false,
    structureInstruction: "",
    targetWordCount: 0,
  };
}

/**
 * CRUD del catálogo de tipos de noticia. Cada tipo decide qué etapas opcionales se ejecutan y
 * aporta directrices de formato. La etapa `research` no es configurable (fuente de verdad).
 */
export function NewsTypesForm({ initialTypes }: { initialTypes: NewsType[] }) {
  const [types, setTypes] = useState<NewsType[]>(initialTypes);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function patch(index: number, change: Partial<NewsType>) {
    setTypes((prev) => prev.map((t, i) => (i === index ? { ...t, ...change } : t)));
  }

  async function save() {
    setStatus("saving");
    setMessage(null);
    try {
      await saveNewsTypes(types);
      setMessage("Tipos de noticia guardados.");
    } catch {
      setMessage("No se pudieron guardar (revisa que los identificadores sean únicos y válidos).");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Tipos de noticia</h2>
        <p className="text-muted text-sm">
          Presets que adaptan el pipeline a cada formato: qué fases de calidad se ejecutan,
          adherencia a las fuentes, estructura y longitud. El usuario elige uno al generar.
        </p>
      </div>

      {message ? <p className="text-muted text-sm">{message}</p> : null}

      {types.map((type, index) => (
        <fieldset key={index} className="border-muted/20 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold">{type.label || "(sin nombre)"}</legend>
            <button
              type="button"
              onClick={() => setTypes((prev) => prev.filter((_, i) => i !== index))}
              className="text-xs font-medium text-red-600"
            >
              Eliminar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nombre</span>
              <input
                value={type.label}
                onChange={(e) => patch(index, { label: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Identificador (minúsculas, guiones)</span>
              <input
                value={type.id}
                onChange={(e) => patch(index, { id: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Descripción</span>
            <input
              value={type.description}
              onChange={(e) => patch(index, { description: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={type.enableHumanize}
                onChange={(e) => patch(index, { enableHumanize: e.target.checked })}
              />
              <span>Humanización</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={type.enableFactualReview}
                onChange={(e) => patch(index, { enableFactualReview: e.target.checked })}
              />
              <span>Revisión factual</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={type.enableQualityReview}
                onChange={(e) => patch(index, { enableQualityReview: e.target.checked })}
              />
              <span>Control de calidad</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={type.sourceStrict}
                onChange={(e) => patch(index, { sourceStrict: e.target.checked })}
              />
              <span>Ceñirse a las fuentes</span>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Instrucción de estructura</span>
            <textarea
              rows={2}
              value={type.structureInstruction}
              onChange={(e) => patch(index, { structureInstruction: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Palabras objetivo (0 = sin objetivo)</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={type.targetWordCount}
              onChange={(e) => patch(index, { targetWordCount: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </label>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTypes((prev) => [...prev, emptyType(prev.length + 1)])}
          className="border-muted/30 rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir tipo
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "saving" ? "Guardando…" : "Guardar tipos"}
        </button>
      </div>
    </section>
  );
}
