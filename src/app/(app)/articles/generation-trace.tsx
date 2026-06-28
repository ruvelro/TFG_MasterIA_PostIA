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
  /** Coste estimado de la etapa en USD (null si no se pudo estimar). */
  costUsd?: number | null;
}

// Formatea un importe en USD con la precisión adecuada para céntimos de fracción.
function formatUsd(value: number): string {
  return `$${value.toFixed(value < 0.01 ? 5 : 4)}`;
}

// Traza de generación: muestra qué modelo usó cada etapa, tokens, duración y coste estimado.
// Aprovecha los `GenerationStep` que el orquestador persiste y demuestra la trazabilidad y el
// coste del pipeline. El coste se estima en el servidor a partir de los precios de OpenRouter.
export function GenerationTrace({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) return null;

  const costs = steps.map((step) => step.costUsd).filter((cost): cost is number => cost != null);
  const totalCost = costs.reduce((sum, cost) => sum + cost, 0);

  return (
    <details className="border-muted/15 hover:border-primary/40 bg-foreground/[0.02] rounded-lg border p-3 transition-colors">
      <summary className="cursor-pointer text-sm font-medium">
        Detalles de generación
        {costs.length > 0 ? (
          <span className="text-muted ml-2 font-normal">· coste ≈ {formatUsd(totalCost)}</span>
        ) : null}
      </summary>
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
            {step.costUsd != null ? <span>≈ {formatUsd(step.costUsd)}</span> : null}
            <span>estado: {step.status}</span>
          </li>
        ))}
      </ul>
      {costs.length > 0 ? (
        <p className="text-muted mt-3 text-xs">
          Coste total estimado:{" "}
          <span className="text-foreground font-medium">{formatUsd(totalCost)}</span> (estimado al
          generar con los precios de OpenRouter; orientativo)
        </p>
      ) : null}
    </details>
  );
}
