import { getCostStats } from "@/lib/observability/cost-stats";

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

/**
 * Panel de coste (server component). Agrega el coste estimado ya persistido por etapa y lo muestra
 * por usuario. Se renderiza dentro del panel de Admin, ya protegido por rol, así que la consulta
 * (que cruza datos de todos los usuarios) está autorizada.
 */
export async function CostPanel() {
  const stats = await getCostStats(30);

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
    </section>
  );
}
