"use client";

import { useState } from "react";

import type { Facts } from "@/lib/pipeline/schemas";

// Pantalla de revisión humana: el usuario valida o matiza los hechos extraídos (añadir,
// editar o eliminar) antes de que el pipeline redacte el artículo.
export function FactsReview({
  initialFacts,
  disabled,
  onContinue,
}: {
  initialFacts: Facts;
  disabled: boolean;
  onContinue: (facts: Facts) => void;
}) {
  const [items, setItems] = useState(initialFacts.facts);

  const inputClass =
    "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

  function update(index: number, patch: Partial<{ claim: string; source: string }>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    setItems((prev) => [...prev, { claim: "", source: "" }]);
  }

  function handleContinue() {
    // Descartamos hechos vacíos antes de continuar.
    const facts = items.filter((item) => item.claim.trim().length > 0);
    onContinue({ facts });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Revisa los datos extraídos</h2>
        <p className="text-muted text-sm">
          Estos hechos son la fuente de verdad del artículo. Edítalos, elimínalos o añade otros.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={index} className="border-muted/20 flex flex-col gap-2 rounded-md border p-3">
            <textarea
              value={item.claim}
              onChange={(event) => update(index, { claim: event.target.value })}
              placeholder="Hecho"
              rows={2}
              className={inputClass}
            />
            <input
              value={item.source}
              onChange={(event) => update(index, { source: event.target.value })}
              placeholder="Fuente (URL)"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="self-end text-xs font-medium text-red-600"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="border-muted/30 rounded-md border px-3 py-2 text-sm font-medium"
        >
          Añadir hecho
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={disabled}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Continuar y redactar
        </button>
      </div>
    </div>
  );
}
