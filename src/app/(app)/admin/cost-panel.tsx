import {
  getCostBreakdown,
  getCostStats,
  type CostBreakdownRow,
} from "@/lib/observability/cost-stats";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

// Los costes por generación son importes muy pequeños (céntimos o fracciones), así que mostramos
// 4 decimales para que no se redondeen a 0,00 $. Es instrumentación informativa, no contable.
function formatUsd(value: number): string {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatInt(value: number): string {
  return value.toLocaleString("es-ES");
}

const STAGE_LABEL = new Map<string, string>(
  PIPELINE_STAGES.map((stage) => [stage.id, stage.label]),
);

/**
 * Tabla de desglose de coste (por etapa o por modelo). Comparte estructura para no duplicar
 * marcado: muestra volumen (ejecuciones y tokens), coste total y coste medio por ejecución, que
 * es lo que permite comparar el coste unitario entre dimensiones con distinto volumen.
 */
function BreakdownTable({
  rows,
  keyHeader,
  labelFor,
}: {
  rows: CostBreakdownRow[];
  keyHeader: string;
  labelFor?: (key: string) => string;
}) {
  if (rows.length === 0) return <p className="text-muted text-sm">Sin datos todavía.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-muted/20 text-muted border-b text-left">
            <th className="py-2 font-medium">{keyHeader}</th>
            <th className="py-2 text-right font-medium">Ejec.</th>
            <th className="py-2 text-right font-medium">Tokens in</th>
            <th className="py-2 text-right font-medium">Tokens out</th>
            <th className="py-2 text-right font-medium">Coste total</th>
            <th className="py-2 text-right font-medium">Coste/ejec.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-muted/10 border-b">
              <td className="py-2">
                {labelFor ? (
                  labelFor(row.key)
                ) : (
                  <span className="font-mono text-xs">{row.key}</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{formatInt(row.steps)}</td>
              <td className="py-2 text-right tabular-nums">{formatInt(row.tokensInput)}</td>
              <td className="py-2 text-right tabular-nums">{formatInt(row.tokensOutput)}</td>
              <td className="py-2 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
              <td className="text-muted py-2 text-right tabular-nums">
                {formatUsd(row.avgUsdPerStep)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Panel de coste (server component). Agrega el coste estimado ya persistido por etapa y lo muestra
 * por usuario. Se renderiza dentro del panel de Admin, ya protegido por rol, así que la consulta
 * (que cruza datos de todos los usuarios) está autorizada.
 */
export async function CostPanel() {
  const [stats, breakdown] = await Promise.all([getCostStats(30), getCostBreakdown()]);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Coste de generación</h2>
        <p className="text-muted text-sm">
          Coste estimado a partir de los tokens consumidos por etapa y los precios de OpenRouter
          (congelado al generar). Es una estimación informativa, no una factura.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border-muted/20 flex flex-col gap-1 rounded-lg border p-4">
          <span className="text-muted text-xs">Total acumulado</span>
          <span className="text-xl font-semibold">{formatUsd(stats.totalUsd)}</span>
        </div>
        <div className="border-muted/20 flex flex-col gap-1 rounded-lg border p-4">
          <span className="text-muted text-xs">Últimos {stats.periodDays} días</span>
          <span className="text-xl font-semibold">{formatUsd(stats.periodUsd)}</span>
        </div>
      </div>

      {stats.byUser.length === 0 ? (
        <p className="text-muted text-sm">Aún no hay coste registrado.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-muted/20 text-muted border-b text-left">
              <th className="py-2 font-medium">Usuario</th>
              <th className="py-2 text-right font-medium">Runs</th>
              <th className="py-2 text-right font-medium">Coste total</th>
            </tr>
          </thead>
          <tbody>
            {stats.byUser.map((row) => (
              <tr key={row.userId} className="border-muted/10 border-b">
                <td className="py-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted ml-2 text-xs">{row.email}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{row.runs}</td>
                <td className="py-2 text-right tabular-nums">{formatUsd(row.totalUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Desglose por etapa: dónde se concentra el coste del pipeline ── */}
      <div className="mt-2 flex flex-col gap-2">
        <h3 className="font-medium">Coste por etapa</h3>
        <p className="text-muted text-xs">
          Reparto del coste entre las etapas del pipeline. Respalda con datos la decisión de usar un
          modelo distinto por paso: revela qué etapas dominan el gasto.
        </p>
        <BreakdownTable
          rows={breakdown.byStage}
          keyHeader="Etapa"
          labelFor={(key) => STAGE_LABEL.get(key) ?? key}
        />
      </div>

      {/* ── Desglose por modelo: coste unitario de cada modelo empleado ── */}
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Coste por modelo</h3>
        <p className="text-muted text-xs">
          Coste y tokens agregados por modelo de OpenRouter. Útil para comparar el coste unitario
          antes de escalar una etapa a un modelo más caro.
        </p>
        <BreakdownTable rows={breakdown.byModel} keyHeader="Modelo" />
      </div>
    </section>
  );
}
