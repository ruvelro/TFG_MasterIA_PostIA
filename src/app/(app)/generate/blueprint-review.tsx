"use client";

import { useState } from "react";

import type { Blueprint } from "@/lib/pipeline/schemas";

type Section = Blueprint["sections"][number];

// Pantalla de revisión humana: el usuario valida o ajusta la estructura del artículo
// (titular, ángulo, keyword y secciones) antes de que el pipeline redacte el borrador.
export function BlueprintReview({
  initialBlueprint,
  disabled,
  onContinue,
}: {
  initialBlueprint: Blueprint;
  disabled: boolean;
  onContinue: (blueprint: Blueprint) => void;
}) {
  const [title, setTitle] = useState(initialBlueprint.title);
  const [angle, setAngle] = useState(initialBlueprint.angle);
  const [readerPromise, setReaderPromise] = useState(initialBlueprint.readerPromise);
  const [mainThesis, setMainThesis] = useState(initialBlueprint.mainThesis);
  const [leadAngle, setLeadAngle] = useState(initialBlueprint.leadAngle);
  const [excludeOrCompress, setExcludeOrCompress] = useState(
    initialBlueprint.excludeOrCompress.join("\n"),
  );
  const [targetKeyword, setTargetKeyword] = useState(initialBlueprint.targetKeyword);
  const [sections, setSections] = useState<Section[]>(initialBlueprint.sections);

  const inputClass =
    "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

  function updateSection(index: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function addSection() {
    setSections((prev) => [...prev, { heading: "", summary: "" }]);
  }

  function handleContinue() {
    const cleanSections = sections.filter((s) => s.heading.trim().length > 0);
    onContinue({
      title,
      angle,
      readerPromise,
      mainThesis,
      leadAngle,
      excludeOrCompress: excludeOrCompress
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      targetKeyword,
      sections: cleanSections,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Revisa la estructura del artículo</h2>
        <p className="text-muted text-sm">
          Ajusta el titular, el ángulo y las secciones antes de que comience la redacción.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Titular de trabajo</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Ángulo / enfoque principal</span>
        <input value={angle} onChange={(e) => setAngle(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Promesa al lector</span>
        <input
          value={readerPromise}
          onChange={(e) => setReaderPromise(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tesis principal</span>
        <input
          value={mainThesis}
          onChange={(e) => setMainThesis(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Entradilla debe abrir con</span>
        <input
          value={leadAngle}
          onChange={(e) => setLeadAngle(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Omitir o comprimir</span>
        <textarea
          value={excludeOrCompress}
          onChange={(e) => setExcludeOrCompress(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Keyword objetivo</span>
        <input
          value={targetKeyword}
          onChange={(e) => setTargetKeyword(e.target.value)}
          className={inputClass}
        />
      </label>

      <div>
        <span className="text-sm font-medium">Secciones</span>
        <ul className="mt-2 flex flex-col gap-3">
          {sections.map((section, index) => (
            <li key={index} className="border-muted/20 flex flex-col gap-2 rounded-md border p-3">
              <input
                value={section.heading}
                onChange={(e) => updateSection(index, { heading: e.target.value })}
                placeholder="Título de la sección"
                className={inputClass}
              />
              <textarea
                value={section.summary}
                onChange={(e) => updateSection(index, { summary: e.target.value })}
                placeholder="Enfoque o resumen de la sección"
                rows={2}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeSection(index)}
                className="self-end text-xs font-medium text-red-600"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={addSection}
        className="border-muted/30 self-start rounded-md border px-3 py-2 text-sm font-medium"
      >
        Añadir sección
      </button>

      {/* Barra de acción fija: el botón de continuar siempre visible, como en la revisión de hechos. */}
      <div className="border-muted/20 bg-background/90 sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t py-3 backdrop-blur">
        <span className="text-muted text-sm">
          {sections.length} {sections.length === 1 ? "sección" : "secciones"}
        </span>
        <button
          type="button"
          onClick={handleContinue}
          disabled={disabled}
          className="bg-primary rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Continuar y redactar
        </button>
      </div>
    </div>
  );
}
