"use client";

import { useCallback, useRef, useState } from "react";

import type { ArticleEnrichment, Blueprint, Facts, FixerOutput } from "@/lib/pipeline/schemas";
import { STAGE_IDS, type StageId } from "@/lib/pipeline/stages";
import type { GenerationOverrides, GenerationStreamEvent } from "@/lib/pipeline/stream-events";

export type GeneratorPhase =
  | "idle"
  | "running"
  | "review"
  | "blueprint-review"
  | "finalizing"
  | "done"
  | "error";

export interface StageView {
  status: "pending" | "running" | "done" | "error" | "skipped";
  attempt: number;
  model?: string;
}

export type StageMap = Record<StageId, StageView>;

function initStages(): StageMap {
  return Object.fromEntries(
    STAGE_IDS.map((id) => [id, { status: "pending", attempt: 0 }]),
  ) as StageMap;
}

export function markPendingStagesAsSkipped(stages: StageMap): StageMap {
  return Object.fromEntries(
    STAGE_IDS.map((id) => {
      const stage = stages[id];
      return [id, stage.status === "pending" ? { ...stage, status: "skipped" } : stage];
    }),
  ) as StageMap;
}

/**
 * Parte un buffer NDJSON en eventos completos y el resto incompleto. Es PURA (sin estado ni
 * red) para poder testearla aisladamente: la última "línea" puede estar a medias y se
 * devuelve en `rest` para concatenarla con el siguiente trozo.
 */
export function splitNdjson(buffer: string): { events: unknown[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const events = parts
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
  return { events, rest };
}

/** Opción de tipo de noticia para el desplegable del formulario. */
export interface NewsTypeOption {
  id: string;
  label: string;
  description: string;
}

/** Opción de preset de longitud para el desplegable del formulario. */
export interface LengthPresetOption {
  id: string;
  label: string;
  minWords: number;
  maxWords: number;
}

export interface StartOptions {
  context?: string;
  /** Idioma del artículo (texto libre); si falta, español. */
  language?: string;
  pauseForReview: boolean;
  pauseForBlueprintReview: boolean;
  newsTypeId?: string;
  lengthPresetId?: string;
  overrides?: GenerationOverrides;
}

/**
 * Hook que conduce una generación de principio a fin sobre el stream NDJSON del endpoint.
 * Modela el flujo como una pequeña máquina de estados (`phase`) y expone `start`/`resume`/
 * `resumeFromBlueprint`.
 */
export function useGenerationStream() {
  const [phase, setPhase] = useState<GeneratorPhase>("idle");
  const [stages, setStages] = useState<StageMap>(initStages);
  // Salida de cada etapa (fuentes, hechos, informes…) para mostrarla en los desplegables de detalle.
  const [stageData, setStageData] = useState<Partial<Record<StageId, unknown>>>({});
  const [facts, setFacts] = useState<Facts | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [article, setArticle] = useState<FixerOutput | null>(null);
  const [enrichment, setEnrichment] = useState<ArticleEnrichment | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  // Controlador de aborto de la petición en curso, para poder cancelar la generación.
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback((event: GenerationStreamEvent) => {
    switch (event.type) {
      case "stage":
        setStages((prev) => ({
          ...prev,
          [event.stageId]: { status: event.status, attempt: event.attempt, model: event.model },
        }));
        // Al terminar una etapa puede traer su salida; la guardamos para el desplegable de detalle.
        if (event.data !== undefined) {
          setStageData((prev) => ({ ...prev, [event.stageId]: event.data }));
        }
        break;
      case "awaiting_review":
        runIdRef.current = event.runId;
        setFacts(event.facts);
        setPhase("review");
        break;
      case "awaiting_blueprint_review":
        runIdRef.current = event.runId;
        setBlueprint(event.blueprint);
        setPhase("blueprint-review");
        break;
      case "needs_review":
      case "completed":
        setArticle(event.article);
        setEnrichment(event.enrichment ?? null);
        setArticleId(event.articleId ?? null);
        setStages(markPendingStagesAsSkipped);
        setPhase("done");
        break;
      case "error":
        setError(event.message);
        setPhase("error");
        break;
    }
  }, []);

  const consume = useCallback(
    async (response: Response) => {
      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "");
        setError(message || "No se pudo iniciar la generación");
        setPhase("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = splitNdjson(buffer);
        buffer = rest;
        for (const event of events) handleEvent(event as GenerationStreamEvent);
      }

      // Procesa una posible última línea sin salto final.
      const { events } = splitNdjson(`${buffer}\n`);
      for (const event of events) handleEvent(event as GenerationStreamEvent);
    },
    [handleEvent],
  );

  const start = useCallback(
    async (topic: string, options: StartOptions) => {
      setError(null);
      setArticle(null);
      setArticleId(null);
      setFacts(null);
      setBlueprint(null);
      setStages(initStages());
      setStageData({});
      runIdRef.current = null;
      setPhase("running");

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, ...options }),
          signal: controller.signal,
        });
        await consume(response);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // cancelado por el usuario
        setError("Error de red durante la generación");
        setPhase("error");
      }
    },
    [consume],
  );

  const resume = useCallback(
    async (editedFacts: Facts, overrides?: GenerationOverrides) => {
      const runId = runIdRef.current;
      if (!runId) return;

      setError(null);
      setPhase("finalizing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/generate/${runId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedFacts, overrides }),
          signal: controller.signal,
        });
        await consume(response);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setError("Error de red al reanudar la generación");
        setPhase("error");
      }
    },
    [consume],
  );

  const resumeFromBlueprint = useCallback(
    async (editedBlueprint: Blueprint, overrides?: GenerationOverrides) => {
      const runId = runIdRef.current;
      if (!runId) return;

      setError(null);
      setPhase("finalizing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/generate/${runId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedBlueprint, overrides }),
          signal: controller.signal,
        });
        await consume(response);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setError("Error de red al reanudar desde la estructura");
        setPhase("error");
      }
    },
    [consume],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setStages(initStages());
    setStageData({});
    setFacts(null);
    setBlueprint(null);
    setArticle(null);
    setEnrichment(null);
    setArticleId(null);
    setError(null);
    runIdRef.current = null;
  }, []);

  /**
   * Cancela la generación en curso: aborta la petición (lo que, en el servidor, interrumpe la
   * llamada de IA actual y detiene el pipeline para no malgastar tokens) y vuelve al formulario.
   */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  return {
    phase,
    stages,
    stageData,
    facts,
    blueprint,
    article,
    enrichment,
    articleId,
    error,
    start,
    resume,
    resumeFromBlueprint,
    reset,
    cancel,
  };
}
