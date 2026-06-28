import type { z } from "zod";

import type { AiStageId, StepConfig } from "@/lib/pipeline/default-config";
import type {
  ArticleEnrichment,
  Blueprint,
  Facts,
  FactualReview,
  FixerOutput,
  LengthPreset,
  NewsType,
  QualityReview,
  ScrubPattern,
  ValidationReport,
  ValidatorConfig,
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
  /** Tipo de noticia seleccionado (presets del pipeline). Si falta, se usa el comportamiento completo. */
  newsType?: NewsType;
  /** Preset de longitud seleccionado; tiene prioridad sobre el targetWordCount del tipo. */
  lengthPreset?: LengthPreset;
  /** Instrucciones de revisión (reenvío dirigido): se inyectan en validate y fixer. */
  revisionInstructions?: string;
  /** Contexto adicional aportado por el usuario (datos, enlaces, matices); se inyecta en los prompts. */
  context?: string;
  /**
   * Si el usuario pidió revisar la estructura antes de redactar. Se persiste en el contexto para
   * sobrevivir a la pausa de extracción: al reanudar desde `awaiting_review` el orquestador lo
   * relee y vuelve a pausar tras el blueprint (de lo contrario el flag se perdería).
   */
  pauseForBlueprintReview?: boolean;
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
  /**
   * Estima el coste en USD de una etapa a partir de su modelo y tokens (precios de OpenRouter).
   * Inyectada para no acoplar el orquestador a la red ni a precios concretos: en tests devuelve
   * valores deterministas. `null` cuando no se puede estimar (sin modelo, sin precio, etc.).
   */
  estimateCost: (
    model: string | null,
    inputTokens: number | null,
    outputTokens: number | null,
  ) => Promise<number | null>;
}

/** Configuración resuelta de la generación (modelo+prompt por etapa ya con overrides aplicados). */
export interface ResolvedPipelineConfig {
  steps: Record<AiStageId, StepConfig>;
  /** Perfil de estilo ya renderizado a texto (voz, reglas de casa, autoridad, ejemplos…). */
  editorialVoice: string;
  /** Reglas de optimización para buscadores (SEO). */
  seoRules: string;
  /** Reglas de optimización para motores generativos (GEO). */
  geoRules: string;
  sourceCount: number;
  maxFixIterations: number;
  /** Máximo de re-humanizaciones automáticas cuando aiScore supera el umbral. */
  maxHumanizeRetries: number;
  /** Umbral de aiScore (0-100) a partir del cual se re-humaniza el borrador. */
  aiScoreThreshold: number;
  /** Patrones de expresiones regulares para la limpieza final del artículo. */
  scrubPatterns: ScrubPattern[];
  /** Palabras prohibidas del perfil de estilo (las usa el validador determinista). */
  forbiddenWords: string[];
  /** Configuración del validador editorial determinista. */
  validatorConfig: ValidatorConfig;
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
  /** Salida de la etapa (al terminar) para el desplegable de detalle de la UI. */
  data?: unknown;
}

export type StageEventHandler = (event: StageEvent) => void;
