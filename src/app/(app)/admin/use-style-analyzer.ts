"use client";

import { useState } from "react";

import type { StyleAnalysisResult } from "@/lib/pipeline/schemas";

/**
 * Evento del stream del analizador de estilo (espejo del tipo del route handler, para no importar
 * código de servidor en el cliente).
 */
export type AnalysisEvent =
  | { type: "progress"; phase: "fetch" | "analyze"; done: number; total: number }
  | { type: "progress"; phase: "consolidate" }
  | { type: "result"; profile: StyleAnalysisResult }
  | { type: "error"; message: string };

/**
 * Hook compartido que consume el stream NDJSON de `/api/admin/analyze-style` y entrega el perfil
 * resultante por callback. Lo usan tanto el estilo global de la marca como la voz por tipo de
 * noticia, para no duplicar la lógica de descarga/análisis. `analyze` ignora segundas llamadas
 * mientras hay una en curso.
 */
export function useStyleAnalyzer(onResult: (profile: StyleAnalysisResult) => void) {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEvent(event: AnalysisEvent) {
    switch (event.type) {
      case "progress":
        if (event.phase === "fetch") setProgress(`Descargando ${event.done}/${event.total} URLs…`);
        else if (event.phase === "analyze")
          setProgress(`Analizando lote ${event.done}/${event.total}…`);
        else setProgress("Consolidando el perfil…");
        break;
      case "result":
        setProgress(null);
        onResult(event.profile);
        break;
      case "error":
        setProgress(null);
        setError(event.message);
        break;
    }
  }

  async function analyze(urls: string[]): Promise<void> {
    if (analyzing) return;
    if (urls.length === 0) {
      setError("Pega al menos una URL.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setProgress("Iniciando…");
    try {
      const response = await fetch("/api/admin/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!response.ok || !response.body) {
        setError(`Error: ${(await response.text()) || "no se pudo iniciar el análisis"}`);
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
          if (line.trim()) handleEvent(JSON.parse(line) as AnalysisEvent);
        }
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as AnalysisEvent);
    } catch {
      setError("Error de red durante el análisis.");
    } finally {
      setAnalyzing(false);
    }
  }

  return { analyze, analyzing, progress, error, setError };
}
