"use client";

import { useMemo, useState } from "react";

import type { ErrorLogRow } from "@/lib/observability/repository";

const CATEGORY_LABEL: Record<string, string> = {
  auth: "Autenticación",
  pipeline: "Generación / modelo",
  server: "Servidor",
};

const CATEGORY_BADGE: Record<string, string> = {
  auth: "bg-amber-100 text-amber-800",
  pipeline: "bg-red-100 text-red-800",
  server: "bg-slate-200 text-slate-800",
};

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" });
}

/**
 * Tabla de errores con filtro por categoría (en memoria, sin recargar). El filtrado es del lado
 * cliente porque el conjunto está acotado (máx. 200 filas) y así evitamos round-trips al servidor.
 */
export function ErrorLogTable({ rows }: { rows: ErrorLogRow[] }) {
  const [filter, setFilter] = useState<string>("all");

  // Categorías presentes + recuento, para construir los botones de filtro dinámicamente.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return [...counts.entries()];
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  const filterButton = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        filter === id ? "bg-primary text-white" : "border-muted/30 border"
      }`}
    >
      {label} ({count})
    </button>
  );

  if (rows.length === 0) {
    return <p className="text-muted text-sm">No hay errores registrados. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {filterButton("all", "Todos", rows.length)}
        {categories.map(([cat, count]) => filterButton(cat, CATEGORY_LABEL[cat] ?? cat, count))}
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((row) => (
          <li
            key={row.id}
            className="border-muted/20 flex flex-col gap-1 rounded-md border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  CATEGORY_BADGE[row.category] ?? "bg-slate-200 text-slate-800"
                }`}
              >
                {CATEGORY_LABEL[row.category] ?? row.category}
              </span>
              <span className="text-muted text-xs">{formatDate(row.createdAt)}</span>
              {row.userId ? (
                <span className="text-muted text-xs">· usuario {row.userId}</span>
              ) : null}
            </div>
            <p className="font-medium">{row.message}</p>
            {row.detail ? (
              <pre className="text-muted overflow-x-auto text-xs break-words whitespace-pre-wrap">
                {row.detail}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
