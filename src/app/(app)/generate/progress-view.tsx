import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

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

export function ProgressView({ stages }: { stages: StageMap }) {
  return (
    <ol className="flex flex-col gap-2">
      {PIPELINE_STAGES.map((stage) => {
        const state = stages[stage.id];
        return (
          <li
            key={stage.id}
            className="border-muted/20 flex items-center gap-3 rounded-md border p-3"
          >
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
          </li>
        );
      })}
    </ol>
  );
}
