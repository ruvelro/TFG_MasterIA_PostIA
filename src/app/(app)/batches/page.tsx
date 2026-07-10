import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { getNewsTypes } from "@/lib/settings/news-types";

import { BatchesView } from "./batches-view";

/** Generación por lotes: crear un lote de temas y seguir su progreso. */
export default async function BatchesPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  const newsTypes = await getNewsTypes();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Generación por lotes</h1>
        <p className="text-muted text-sm">
          Pega una lista de temas y el pipeline los generará en segundo plano, uno a uno. Los
          artículos quedan como borradores en tu historial, pendientes de revisión.
        </p>
      </header>
      <BatchesView newsTypes={newsTypes.map(({ id, label }) => ({ id, label }))} />
    </div>
  );
}
