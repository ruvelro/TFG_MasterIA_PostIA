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
  status: "pending" | "running" | "done" | "error";
  attempt: number;
  model?: string;
}

export type StageMap = Record<StageId, StageView>;

function initStages(): StageMap {
  return Object.fromEntries(
    STAGE_IDS.map((id) => [id, { status: "pending", attempt: 0 }]),
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

export interface StartOptions {
  pauseForReview: boolean;
  pauseForBlueprintReview: boolean;
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
  const [facts, setFacts] = useState<Facts | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [article, setArticle] = useState<FixerOutput | null>(null);
  const [enrichment, setEnrichment] = useState<ArticleEnrichment | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  const handleEvent = useCallback((event: GenerationStreamEvent) => {
    switch (event.type) {
      case "stage":
        setStages((prev) => ({
          ...prev,
          [event.stageId]: { status: event.status, attempt: event.attempt, model: event.model },
        }));
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
      case "completed":
        setArticle(event.article);
        setEnrichment(event.enrichment ?? null);
        setArticleId(event.articleId ?? null);
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
      runIdRef.current = null;
      setPhase("running");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, ...options }),
        });
        await consume(response);
      } catch {
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
      try {
        const response = await fetch(`/api/generate/${runId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedFacts, overrides }),
        });
        await consume(response);
      } catch {
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
      try {
        const response = await fetch(`/api/generate/${runId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedBlueprint, overrides }),
        });
        await consume(response);
      } catch {
        setError("Error de red al reanudar desde la estructura");
        setPhase("error");
      }
    },
    [consume],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setStages(initStages());
    setFacts(null);
    setBlueprint(null);
    setArticle(null);
    setEnrichment(null);
    setArticleId(null);
    setError(null);
    runIdRef.current = null;
  }, []);

  return {
    phase,
    stages,
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
  };
}
