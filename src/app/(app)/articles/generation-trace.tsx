import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

// Clave como `string` (no `StageId`) porque la traza viene de la BD con stageId genérico.
const STAGE_LABEL = new Map<string, string>(
  PIPELINE_STAGES.map((stage) => [stage.id, stage.label]),
);

// Forma mínima de un paso que necesita la traza (subconjunto de GenerationStep).
export interface TraceStep {
  stageId: string;
  status: string;
  model: string | null;
  durationMs: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  attempt: number;
}

// Traza de generación: muestra qué modelo usó cada etapa, tokens y duración. Aprovecha los
// `GenerationStep` que el orquestador persiste y demuestra la trazabilidad del pipeline.
export function GenerationTrace({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) return null;

  return (
    <details className="border-muted/20 rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Detalles de generación</summary>
      <ul className="mt-3 flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={index} className="text-muted flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            <span className="text-foreground font-medium">
              {STAGE_LABEL.get(step.stageId) ?? step.stageId}
              {step.attempt > 1 ? ` (intento ${step.attempt})` : ""}
            </span>
            {step.model ? <span>modelo: {step.model}</span> : null}
            {step.durationMs != null ? <span>{step.durationMs} ms</span> : null}
            {step.tokensInput != null || step.tokensOutput != null ? (
              <span>
                tokens: {step.tokensInput ?? 0} ↓ / {step.tokensOutput ?? 0} ↑
              </span>
            ) : null}
            <span>estado: {step.status}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
