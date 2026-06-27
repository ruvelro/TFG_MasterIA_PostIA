import { listErrorLogs } from "@/lib/observability/repository";

import { ErrorLogTable } from "./error-log-table";

/**
 * Panel de monitorización de errores (server component). Lee los errores recientes del log
 * unificado y los entrega a la tabla cliente, que permite filtrar por categoría. Se renderiza
 * dentro del panel de Admin, ya protegido por rol.
 */
export async function ErrorLogPanel() {
  const rows = await listErrorLogs({ limit: 200 });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Monitorización de errores</h2>
        <p className="text-muted text-sm">
          Últimos errores registrados: fallos de autenticación, errores de modelo/IA en la
          generación y errores de servidor. Se muestran los 200 más recientes.
        </p>
      </div>

      <ErrorLogTable rows={rows} />
    </section>
  );
}
