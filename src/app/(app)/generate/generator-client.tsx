"use client";

import { useRef } from "react";

import { ArticleResult } from "./article-result";
import { BlueprintReview } from "./blueprint-review";
import { FactsReview } from "./facts-review";
import { GeneratorForm } from "./generator-form";
import { ProgressView } from "./progress-view";
import {
  useGenerationStream,
  type LengthPresetOption,
  type NewsTypeOption,
} from "./use-generation-stream";

// Orquesta la experiencia del generador conmutando entre subvistas según la fase del stream.
export function GeneratorClient({
  newsTypes,
  lengthPresets,
}: {
  newsTypes: NewsTypeOption[];
  lengthPresets: LengthPresetOption[];
}) {
  const {
    phase,
    stages,
    stageData,
    facts,
    blueprint,
    article,
    enrichment,
    articleId,
    error,
    start,
    resume,
    resumeFromBlueprint,
    reset,
    cancel,
  } = useGenerationStream();

  // Ancla de la zona de revisión: el aviso de "requiere intervención" salta hasta aquí.
  const reviewRef = useRef<HTMLDivElement>(null);

  const busy = phase === "running" || phase === "finalizing";
  const showForm = phase === "idle" || phase === "error";
  const needsReview = phase === "review" || phase === "blueprint-review";
  // La generación está "viva" mientras no esté en reposo, terminada ni en error.
  const isActive = busy || needsReview;
  const showProgress =
    phase === "running" || needsReview || phase === "finalizing" || phase === "done";

  function jumpToReview() {
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-8">
      {showForm ? (
        <GeneratorForm
          disabled={busy}
          newsTypes={newsTypes}
          lengthPresets={lengthPresets}
          onSubmit={start}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {/* Estado + cancelar: detiene la generación a medio proceso para no malgastar tokens. */}
      {isActive ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted text-sm">
            {busy ? "Generando…" : "En pausa, esperando tu revisión."}
          </span>
          <button
            type="button"
            onClick={cancel}
            className="border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-500/60"
          >
            Cancelar generación
          </button>
        </div>
      ) : null}

      {/* Aviso de pausa: la generación espera tu revisión. El botón lleva directo al formulario. */}
      {needsReview ? (
        <div
          role="alert"
          className="border-primary/40 bg-primary/10 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <span className="bg-primary inline-block size-2.5 shrink-0 animate-pulse rounded-full" />
            <span>
              <strong>Generación en pausa.</strong>{" "}
              {phase === "review"
                ? "Revisa los datos extraídos para continuar."
                : "Revisa la estructura para continuar."}
            </span>
          </span>
          <button
            type="button"
            onClick={jumpToReview}
            className="bg-primary shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Ir a la revisión ↓
          </button>
        </div>
      ) : null}

      {showProgress ? <ProgressView stages={stages} stageData={stageData} /> : null}

      <div ref={reviewRef} className="scroll-mt-6">
        {phase === "review" && facts ? (
          <FactsReview
            initialFacts={facts}
            disabled={busy}
            onContinue={(edited) => resume(edited)}
          />
        ) : null}

        {phase === "blueprint-review" && blueprint ? (
          <BlueprintReview
            initialBlueprint={blueprint}
            disabled={busy}
            onContinue={(edited) => resumeFromBlueprint(edited)}
          />
        ) : null}
      </div>

      {phase === "done" && article ? (
        <ArticleResult
          article={article}
          enrichment={enrichment}
          articleId={articleId}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}
