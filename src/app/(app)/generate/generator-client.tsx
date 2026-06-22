"use client";

import { ArticleResult } from "./article-result";
import { FactsReview } from "./facts-review";
import { GeneratorForm } from "./generator-form";
import { ProgressView } from "./progress-view";
import { useGenerationStream } from "./use-generation-stream";

// Orquesta la experiencia del generador conmutando entre subvistas según la fase del stream.
export function GeneratorClient() {
  const { phase, stages, facts, article, articleId, error, start, resume, reset } =
    useGenerationStream();

  const busy = phase === "running" || phase === "finalizing";
  const showForm = phase === "idle" || phase === "error";
  const showProgress =
    phase === "running" || phase === "review" || phase === "finalizing" || phase === "done";

  return (
    <div className="flex flex-col gap-8">
      {showForm ? <GeneratorForm disabled={busy} onSubmit={start} /> : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {showProgress ? <ProgressView stages={stages} /> : null}

      {phase === "review" && facts ? (
        <FactsReview initialFacts={facts} disabled={busy} onContinue={(edited) => resume(edited)} />
      ) : null}

      {phase === "done" && article ? (
        <ArticleResult article={article} articleId={articleId} onReset={reset} />
      ) : null}
    </div>
  );
}
