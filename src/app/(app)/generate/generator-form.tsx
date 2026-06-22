"use client";

import { useState } from "react";

import { AI_STAGE_IDS } from "@/lib/pipeline/default-config";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";
import type { GenerationOverrides } from "@/lib/pipeline/stream-events";

import type { StartOptions } from "./use-generation-stream";

const STAGE_LABEL = new Map(PIPELINE_STAGES.map((stage) => [stage.id, stage.label]));

interface OverrideField {
  model: string;
  prompt: string;
}

type OverridesState = Record<string, OverrideField>;

const EMPTY_OVERRIDES: OverridesState = Object.fromEntries(
  AI_STAGE_IDS.map((id) => [id, { model: "", prompt: "" }]),
);

// Construye el objeto de overrides quedándose solo con los campos que el usuario rellenó.
function buildOverrides(state: OverridesState): GenerationOverrides | undefined {
  const overrides: GenerationOverrides = {};
  for (const stageId of AI_STAGE_IDS) {
    const field = state[stageId];
    const entry: { model?: string; prompt?: string } = {};
    if (field.model.trim()) entry.model = field.model.trim();
    if (field.prompt.trim()) entry.prompt = field.prompt;
    if (entry.model || entry.prompt) overrides[stageId] = entry;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export function GeneratorForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (topic: string, options: StartOptions) => void;
}) {
  const [topic, setTopic] = useState("");
  const [pauseForReview, setPauseForReview] = useState(true);
  const [overrides, setOverrides] = useState<OverridesState>(EMPTY_OVERRIDES);

  const inputClass =
    "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (topic.trim().length < 5) return;
    onSubmit(topic.trim(), { pauseForReview, overrides: buildOverrides(overrides) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tema del artículo</span>
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="p. ej. Tendencias de energía solar en 2026"
          className={inputClass}
          required
          minLength={5}
          maxLength={200}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pauseForReview}
          onChange={(event) => setPauseForReview(event.target.checked)}
        />
        <span>Revisar los datos extraídos antes de redactar</span>
      </label>

      <details className="border-muted/20 rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Avanzado: modelo y prompt por etapa (opcional)
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {AI_STAGE_IDS.map((stageId) => (
            <div key={stageId} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{STAGE_LABEL.get(stageId) ?? stageId}</span>
              <input
                value={overrides[stageId].model}
                onChange={(event) =>
                  setOverrides((prev) => ({
                    ...prev,
                    [stageId]: { ...prev[stageId], model: event.target.value },
                  }))
                }
                placeholder="Modelo (vacío = usar el configurado)"
                className={inputClass}
              />
              <textarea
                value={overrides[stageId].prompt}
                onChange={(event) =>
                  setOverrides((prev) => ({
                    ...prev,
                    [stageId]: { ...prev[stageId], prompt: event.target.value },
                  }))
                }
                placeholder="Prompt (vacío = usar el configurado)"
                rows={3}
                className={`${inputClass} font-mono`}
              />
            </div>
          ))}
        </div>
      </details>

      <button
        type="submit"
        disabled={disabled}
        className="bg-primary self-start rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        Generar artículo
      </button>
    </form>
  );
}
