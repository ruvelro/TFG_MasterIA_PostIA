"use client";

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
  } = useGenerationStream();

  const busy = phase === "running" || phase === "finalizing";
  const showForm = phase === "idle" || phase === "error";
  const showProgress =
    phase === "running" ||
    phase === "review" ||
    phase === "blueprint-review" ||
    phase === "finalizing" ||
    phase === "done";

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

      {showProgress ? <ProgressView stages={stages} stageData={stageData} /> : null}

      {phase === "review" && facts ? (
        <FactsReview initialFacts={facts} disabled={busy} onContinue={(edited) => resume(edited)} />
      ) : null}

      {phase === "blueprint-review" && blueprint ? (
        <BlueprintReview
          initialBlueprint={blueprint}
          disabled={busy}
          onContinue={(edited) => resumeFromBlueprint(edited)}
        />
      ) : null}

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
