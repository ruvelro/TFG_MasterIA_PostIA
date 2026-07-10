"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

interface BatchItemDto {
  id: string;
  topic: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  articleId: string | null;
  error: string | null;
  costUsd: number | null;
}

interface BatchDto {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "cancelled";
  budgetUsd: number;
  createdAt: string;
  items: BatchItemDto[];
}

const ITEM_STATUS_LABEL: Record<BatchItemDto["status"], string> = {
  pending: "⏳ pendiente",
  running: "⚙️ generando…",
  completed: "✅ completado",
  failed: "❌ fallido",
  skipped: "⏭️ omitido",
};

/**
 * Vista de lotes: formulario de creación y seguimiento. El progreso se sondea cada pocos
 * segundos mientras haya algún lote en marcha (el worker corre en el servidor).
 */
export function BatchesView({ newsTypes }: { newsTypes: { id: string; label: string }[] }) {
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [name, setName] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [budget, setBudget] = useState("0");
  const [newsTypeId, setNewsTypeId] = useState(newsTypes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/batches");
    if (response.ok) setBatches((await response.json()) as BatchDto[]);
  }, []);

  // Carga inicial + sondeo periódico (el worker corre en el servidor). Un único efecto sin
  // dependencias de estado evita re-suscripciones en cascada; 4 s es suficiente frescura.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch("/api/batches");
      if (response.ok && active) setBatches((await response.json()) as BatchDto[]);
    };
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const topics = topicsText
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `Lote de ${topics.length} temas`,
          topics,
          budgetUsd: Number.parseFloat(budget) || 0,
          newsTypeId,
        }),
      });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      setTopicsText("");
      setName("");
      await refresh();
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setCreating(false);
    }
  }

  async function cancel(batchId: string) {
    await fetch(`/api/batches/${batchId}/cancel`, { method: "POST" });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-muted/15 bg-foreground/[0.02] flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Nuevo lote</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Noticias de la semana"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Tipo de noticia</span>
            <select
              value={newsTypeId}
              onChange={(e) => setNewsTypeId(e.target.value)}
              className={inputClass}
            >
              {newsTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Temas (uno por línea, máx. 50)</span>
          <textarea
            rows={5}
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
            placeholder={"La nueva ley de IA en Europa\nBaterías de estado sólido en 2026"}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Presupuesto del lote (USD, 0 = sin límite)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={inputClass}
          />
        </label>
        {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
        <button
          type="button"
          onClick={create}
          disabled={creating || topicsText.trim().length === 0}
          className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {creating ? "Creando…" : "Crear y procesar lote"}
        </button>
      </section>

      {batches.map((batch) => {
        const spent = batch.items.reduce((sum, item) => sum + (item.costUsd ?? 0), 0);
        return (
          <section
            key={batch.id}
            className="border-muted/15 flex flex-col gap-2 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {batch.name} <span className="text-muted font-normal">— {batch.status}</span>
              </h3>
              <div className="text-muted flex items-center gap-3 text-xs">
                <span>
                  {batch.items.filter((i) => i.status === "completed").length}/{batch.items.length}{" "}
                  completados · ${spent.toFixed(4)}
                  {batch.budgetUsd > 0 ? ` / $${batch.budgetUsd.toFixed(2)}` : ""}
                </span>
                {batch.status === "pending" || batch.status === "running" ? (
                  <button
                    type="button"
                    onClick={() => cancel(batch.id)}
                    className="font-medium text-red-600"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {batch.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.topic}</span>
                  <span className="text-muted shrink-0 text-xs">
                    {item.status === "completed" && item.articleId ? (
                      <Link href={`/articles/${item.articleId}`} className="text-primary underline">
                        ver artículo
                      </Link>
                    ) : item.status === "failed" || item.status === "skipped" ? (
                      <span title={item.error ?? undefined}>{ITEM_STATUS_LABEL[item.status]}</span>
                    ) : (
                      ITEM_STATUS_LABEL[item.status]
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
