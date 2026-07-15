"use client";

import { useState } from "react";

import { CollapsibleEditor } from "@/components/collapsible-editor";
import type { NewsType } from "@/lib/pipeline/schemas";

import { saveNewsTypes } from "./actions";
import { useStyleAnalyzer } from "./use-style-analyzer";

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
    voiceBrand: "",
    voiceHouseRules: "",
    voiceExamples: [],
    enableFeatureImage: false,
    freshnessDays: 0,
  };
}

/**
 * Tarjeta de un tipo de noticia. Cada tarjeta tiene su PROPIO entrenador de voz (hook independiente)
 * para que se pueda entrenar un tipo sin afectar a los demás. La voz del tipo COMPLEMENTA a la voz
 * global del portal: aquí solo se define el enfoque específico de este formato.
 */
function NewsTypeCard({
  type,
  onPatch,
  onRemove,
}: {
  type: NewsType;
  onPatch: (change: Partial<NewsType>) => void;
  onRemove: () => void;
}) {
  const [urls, setUrls] = useState("");

  // El analizador devuelve un perfil completo; para la voz del tipo solo tomamos voz, reglas de
  // casa y ejemplos (SEO/GEO/E-E-A-T/idioma son política GLOBAL, no se infieren por tipo).
  const { analyze, analyzing, progress, error } = useStyleAnalyzer((profile) => {
    onPatch({
      voiceBrand: profile.brandVoice,
      voiceHouseRules: profile.houseRules,
      voiceExamples: profile.fewShotExamples,
    });
  });

  function runAnalysis() {
    void analyze(
      urls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
    );
  }

  return (
    <CollapsibleEditor
      title={type.label || "(sin nombre)"}
      description={type.description || type.id}
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600">
            Eliminar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              value={type.label}
              onChange={(e) => onPatch({ label: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Identificador (minúsculas, guiones)</span>
            <input
              value={type.id}
              onChange={(e) => onPatch({ id: e.target.value })}
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Descripción</span>
          <input
            value={type.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            className={inputClass}
          />
        </label>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={type.enableHumanize}
              onChange={(e) => onPatch({ enableHumanize: e.target.checked })}
            />
            <span>Humanización</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={type.enableFactualReview}
              onChange={(e) => onPatch({ enableFactualReview: e.target.checked })}
            />
            <span>Revisión factual</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={type.enableQualityReview}
              onChange={(e) => onPatch({ enableQualityReview: e.target.checked })}
            />
            <span>Control de calidad</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={type.sourceStrict}
              onChange={(e) => onPatch({ sourceStrict: e.target.checked })}
            />
            <span>Ceñirse a las fuentes</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={type.enableFeatureImage}
              onChange={(e) => onPatch({ enableFeatureImage: e.target.checked })}
            />
            <span>Imagen destacada</span>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Instrucción de estructura</span>
          <textarea
            rows={2}
            value={type.structureInstruction}
            onChange={(e) => onPatch({ structureInstruction: e.target.value })}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Palabras objetivo (0 = sin objetivo)</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={type.targetWordCount}
              onChange={(e) => onPatch({ targetWordCount: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Frescura de fuentes en días (0 = sin filtro)</span>
            <input
              type="number"
              min={0}
              max={365}
              value={type.freshnessDays}
              onChange={(e) => onPatch({ freshnessDays: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </label>
        </div>

        {/* ── Voz editorial específica de este tipo (complementa la voz global) ── */}
        <fieldset className="border-muted/20 flex flex-col gap-3 rounded-md border p-3">
          <legend className="px-1 text-xs font-semibold tracking-wide uppercase">
            Voz editorial de este tipo
          </legend>
          <p className="text-muted text-xs">
            Complementa la voz global del portal con el enfoque propio de este formato. Edítala a
            mano o entrénala con URLs de artículos de ESTE tipo.
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Voz/tono específico</span>
            <textarea
              rows={2}
              value={type.voiceBrand}
              onChange={(e) => onPatch({ voiceBrand: e.target.value })}
              placeholder="p. ej. ágil y directo para noticias de última hora"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Reglas de casa de este tipo</span>
            <textarea
              rows={2}
              value={type.voiceHouseRules}
              onChange={(e) => onPatch({ voiceHouseRules: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Ejemplos de referencia de este tipo</span>
            {type.voiceExamples.map((example, i) => (
              <div key={i} className="flex flex-col gap-1">
                <textarea
                  rows={3}
                  value={example}
                  onChange={(e) =>
                    onPatch({
                      voiceExamples: type.voiceExamples.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                  placeholder="Pega un párrafo real escrito en el estilo de este tipo"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    onPatch({ voiceExamples: type.voiceExamples.filter((_, j) => j !== i) })
                  }
                  className="self-end text-xs font-medium text-red-600"
                >
                  Eliminar ejemplo
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onPatch({ voiceExamples: [...type.voiceExamples, ""] })}
              className="border-muted/30 self-start rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Añadir ejemplo
            </button>
          </div>

          <details className="border-muted/20 rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              🌐 Entrenar esta voz desde URLs
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-muted text-xs">
                Pega URLs de artículos representativos de este tipo (una por línea). La IA rellenará
                la voz, las reglas y los ejemplos de arriba para que los revises. No se guarda solo.
              </p>
              <textarea
                rows={4}
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://tu-medio.com/noticia-1\nhttps://tu-medio.com/noticia-2"}
                className={`${inputClass} font-mono`}
              />
              {progress ? <p className="text-primary text-xs">{progress}</p> : null}
              {error ? <p className="text-xs text-red-600">Error: {error}</p> : null}
              <button
                type="button"
                onClick={runAnalysis}
                disabled={analyzing}
                className="bg-primary self-start rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {analyzing ? "Analizando…" : "Analizar y rellenar voz"}
              </button>
            </div>
          </details>
        </fieldset>
      </div>
    </CollapsibleEditor>
  );
}

/**
 * CRUD del catálogo de tipos de noticia. Cada tipo decide qué etapas opcionales se ejecutan,
 * aporta directrices de formato y su propia voz editorial (que complementa la global). La etapa
 * `research` no es configurable (fuente de verdad).
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
          adherencia a las fuentes, estructura, longitud y voz editorial propia. El usuario elige
          uno al generar.
        </p>
      </div>

      {message ? <p className="text-muted text-sm">{message}</p> : null}

      {types.map((type, index) => (
        <NewsTypeCard
          key={index}
          type={type}
          onPatch={(change) => patch(index, change)}
          onRemove={() => setTypes((prev) => prev.filter((_, i) => i !== index))}
        />
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
