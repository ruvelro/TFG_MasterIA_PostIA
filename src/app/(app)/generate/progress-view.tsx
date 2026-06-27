import {
  blueprintToText,
  factsToText,
  factualReviewToText,
  qualityReviewToText,
  reportToText,
  sourcesToText,
} from "@/lib/pipeline/format";
import type {
  Blueprint,
  Facts,
  FactualReview,
  QualityReview,
  ValidationReport,
} from "@/lib/pipeline/schemas";
import { PIPELINE_STAGES, type StageId } from "@/lib/pipeline/stages";
import type { PipelineSource } from "@/lib/pipeline/types";

import type { StageMap, StageView } from "./use-generation-stream";

// Indicador visual por estado de etapa.
const STATUS_DOT: Record<StageView["status"], string> = {
  pending: "bg-muted/30",
  running: "bg-primary animate-pulse",
  done: "bg-green-500",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<StageView["status"], string> = {
  pending: "En espera",
  running: "En curso…",
  done: "Hecho",
  error: "Error",
};

/**
 * Serializadores del detalle por etapa a texto legible para el desplegable. Reutilizan los mismos
 * formateadores del pipeline (puros) para no reinventar el formato. La forma de `data` la conocemos
 * por la etapa, así que casteamos desde `unknown` con seguridad. Las etapas sin entrada (draft,
 * humanize, fixer, scrub) no muestran desplegable: su resultado vive en el artículo final.
 */
const STAGE_DETAIL: Partial<Record<StageId, (data: unknown) => string>> = {
  research: (data) => sourcesToText(data as PipelineSource[]),
  extract: (data) => factsToText(data as Facts),
  blueprint: (data) => blueprintToText(data as Blueprint),
  validate: (data) => reportToText(data as ValidationReport),
  "factual-review": (data) => factualReviewToText(data as FactualReview),
  "quality-review": (data) => qualityReviewToText(data as QualityReview),
  enrich: (data) => JSON.stringify(data, null, 2),
};

function formatStageDetail(stageId: StageId, data: unknown): string | null {
  const formatter = STAGE_DETAIL[stageId];
  if (!formatter || data === undefined || data === null) return null;
  try {
    return formatter(data);
  } catch {
    // Si la forma no es la esperada, caemos a JSON crudo en vez de romper la vista.
    return JSON.stringify(data, null, 2);
  }
}

export function ProgressView({
  stages,
  stageData,
}: {
  stages: StageMap;
  stageData: Partial<Record<StageId, unknown>>;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {PIPELINE_STAGES.map((stage) => {
        const state = stages[stage.id];
        const detail = formatStageDetail(stage.id, stageData[stage.id]);

        const header = (
          <>
            <span
              className={`size-3 shrink-0 rounded-full ${STATUS_DOT[state.status]}`}
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{stage.label}</p>
              <p className="text-muted text-xs">
                {STATUS_LABEL[state.status]}
                {state.attempt > 1 ? ` · intento ${state.attempt}` : ""}
                {state.model ? ` · ${state.model}` : ""}
              </p>
            </div>
          </>
        );

        return (
          <li key={stage.id} className="border-muted/20 rounded-md border">
            {detail ? (
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                  {header}
                  <span className="text-muted text-xs">Ver detalle ▾</span>
                </summary>
                <pre className="text-muted border-muted/20 mt-0 max-h-80 overflow-auto border-t p-3 text-xs break-words whitespace-pre-wrap">
                  {detail}
                </pre>
              </details>
            ) : (
              <div className="flex items-center gap-3 p-3">{header}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
