import type { AiStageId } from "@/lib/pipeline/default-config";
import type { ArticleEnrichment, Blueprint, Facts, FixerOutput } from "@/lib/pipeline/schemas";
import type { StageId } from "@/lib/pipeline/stages";
import type { StageStatus } from "@/lib/pipeline/types";

/**
 * Formato de los eventos que viajan por el stream NDJSON entre el endpoint y el cliente.
 * Es el contrato de cable: lo importan tanto el route handler (servidor) como el hook (UI),
 * de modo que ambos extremos hablan exactamente el mismo idioma.
 */
export type GenerationStreamEvent =
  | {
      type: "stage";
      stageId: StageId;
      status: StageStatus;
      attempt: number;
      model?: string;
      message?: string;
      /** Salida de la etapa (al terminar) para el desplegable de detalle de la UI. */
      data?: unknown;
    }
  | { type: "awaiting_review"; runId: string; facts: Facts }
  | { type: "awaiting_blueprint_review"; runId: string; blueprint: Blueprint }
  | {
      type: "completed";
      runId: string;
      articleId?: string;
      article: FixerOutput;
      enrichment?: ArticleEnrichment;
    }
  | { type: "error"; message: string };

/** Override por etapa que el formulario puede enviar para una generación concreta. */
export type GenerationOverrides = Partial<Record<AiStageId, { model?: string; prompt?: string }>>;
