"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Evento del stream de revisión (subconjunto del contrato de generación que nos interesa aquí).
type ReviseEvent =
  | { type: "stage"; stageId: string; status: string }
  | { type: "completed" | "needs_review"; articleId?: string }
  | { type: "error"; message: string };

/**
 * Reenvío dirigido desde el historial: el usuario describe qué cambiar y se regenera el artículo
 * sin nueva investigación. Al terminar, navega al artículo nuevo. Reutiliza el streaming NDJSON.
 */
export function ReviseArticle({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEvent(event: ReviseEvent) {
    if (event.type === "stage") {
      setProgress(`Revisando… (${event.stageId})`);
    } else if (event.type === "completed" || event.type === "needs_review") {
      setProgress(
        event.type === "completed" ? "Revisión completada." : "Borrador pendiente de revisión.",
      );
      if (event.articleId) {
        router.push(`/articles/${event.articleId}`);
        router.refresh();
      }
    } else if (event.type === "error") {
      setError(event.message);
    }
  }

  async function revise() {
    if (instructions.trim().length < 5) {
      setError("Indica qué revisar (al menos 5 caracteres).");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress("Iniciando…");
    try {
      const response = await fetch(`/api/articles/${articleId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: instructions.trim() }),
      });
      if (!response.ok || !response.body) {
        setError((await response.text()) || "No se pudo iniciar la revisión");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line) as ReviseEvent);
        }
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as ReviseEvent);
    } catch {
      setError("Error de red durante la revisión.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = "border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        Revisar con instrucciones
      </button>
    );
  }

  return (
    <div className="border-muted/20 flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Revisar el artículo</h2>
        <p className="text-muted text-xs">
          Describe qué cambiar. Se regenerará sobre este artículo, sin volver a investigar, y se
          guardará como uno nuevo.
        </p>
      </div>
      <textarea
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="p. ej. Acorta la introducción y añade una sección de preguntas frecuentes."
        className="border-muted/30 focus:border-primary rounded-md border px-3 py-2 text-sm outline-none"
      />
      {progress ? <p className="text-primary text-sm">{progress}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={revise}
          disabled={busy}
          className="bg-primary rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Revisando…" : "Generar revisión"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className={buttonClass}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
