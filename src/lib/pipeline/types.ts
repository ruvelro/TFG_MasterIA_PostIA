import type { z } from "zod";

import type { AiStageId, StepConfig } from "@/lib/pipeline/default-config";
import type {
  ArticleEnrichment,
  Blueprint,
  Facts,
  FactualReview,
  FixerOutput,
  QualityReview,
  ScrubPattern,
  ValidationReport,
} from "@/lib/pipeline/schemas";
import type { StageId } from "@/lib/pipeline/stages";
import type { SearchResult } from "@/lib/search";

/** Una fuente con su contenido ya descargado (la "fuente de verdad" del artículo). */
export interface PipelineSource extends SearchResult {
  content: string;
}

/**
 * Estado acumulado que las etapas van rellenando en orden. Los campos son opcionales
 * porque cada etapa añade el suyo. Es serializable (se guarda en `GenerationRun.contextJson`
 * para poder pausar tras la extracción y reanudar después).
 */
export interface PipelineContext {
  topic: string;
  sources: PipelineSource[];
  facts?: Facts;
  blueprint?: Blueprint;
  draft?: string;
  report?: ValidationReport;
  factualReport?: FactualReview;
  qualityReport?: QualityReview;
  /** Número de veces que se ha ejecutado humanize en esta generación. */
  humanizeAttempts?: number;
  article?: FixerOutput;
  enrichment?: ArticleEnrichment;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Dependencias externas del pipeline, ya enlazadas con la clave de API (la clave vive en el
 * cierre de `build-deps`, no se pasa por el contexto). Inyectarlas permite testear el
 * orquestador con dobles deterministas, sin red ni claves reales.
 */
export interface PipelineDeps {
  runText: (params: {
    modelId: string;
    prompt: string;
  }) => Promise<{ text: string; usage: TokenUsage }>;
  runObject: <T>(params: {
    modelId: string;
    prompt: string;
    schema: z.ZodType<T>;
  }) => Promise<{ object: T; usage: TokenUsage }>;
  search: (query: string, limit: number) => Promise<SearchResult[]>;
  fetchContent: (url: string) => Promise<string>;
}

/** Configuración resuelta de la generación (modelo+prompt por etapa ya con overrides aplicados). */
export interface ResolvedPipelineConfig {
  steps: Record<AiStageId, StepConfig>;
  editorialVoice: string;
  seoRules: string;
  sourceCount: number;
  maxFixIterations: number;
  /** Máximo de re-humanizaciones automáticas cuando aiScore supera el umbral. */
  maxHumanizeRetries: number;
  /** Umbral de aiScore (0-100) a partir del cual se re-humaniza el borrador. */
  aiScoreThreshold: number;
  /** Patrones de expresiones regulares para la limpieza final del artículo. */
  scrubPatterns: ScrubPattern[];
}

export type RunStatus =
  | "pending"
  | "researching"
  | "awaiting_review"
  | "awaiting_blueprint_review"
  | "generating"
  | "completed"
  | "failed";

export type StageStatus = "running" | "done" | "error";

/** Evento de progreso que emite el orquestador (transporte-agnóstico: lo consume la UI vía SSE). */
export interface StageEvent {
  stageId: StageId;
  status: StageStatus;
  attempt: number;
  model?: string;
  message?: string;
}

export type StageEventHandler = (event: StageEvent) => void;
