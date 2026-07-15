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
import type { SearchOptions, SearchResult } from "@/lib/search";

/** Una fuente con su contenido ya descargado (la "fuente de verdad" del artículo). */
export interface PipelineSource extends SearchResult {
  content: string;
  /** URL aportada directamente en el contexto: no compite con el cupo ni el ranking de research. */
  userProvided?: boolean;
  /**
   * Marcada por la heurística anti-inyección de `research`: el cuerpo descargado contenía
   * órdenes dirigidas al modelo, así que se degradó al extracto de búsqueda. Viaja en el
   * contexto para que `sourcesToText` la anote en el prompt de extracción.
   */
  suspicious?: boolean;
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
  /** Idioma del artículo (texto libre para los prompts, p. ej. "inglés"). Default: español. */
  language?: string;
  /** Artículo del que este run es una revisión (Revision Mode): el hijo enlaza al padre. */
  parentArticleId?: string;
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
  /** Ruta relativa de la imagen destacada generada (etapa feature-image), si la hay. */
  featuredImagePath?: string;
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
  search: (query: string, limit: number, options?: SearchOptions) => Promise<SearchResult[]>;
  fetchContent: (url: string) => Promise<string>;
  /** Genera una imagen con un modelo de imagen (vía OpenRouter). Devuelve el binario en base64. */
  runImage: (params: {
    modelId: string;
    prompt: string;
  }) => Promise<{ imageBase64: string; mediaType: string; usage: TokenUsage }>;
  /**
   * Persiste una imagen generada y devuelve su ruta relativa (la que se guarda en Article).
   * Inyectada para que el orquestador no toque el sistema de ficheros (testeable en memoria).
   */
  storeImage: (params: {
    runId: string;
    imageBase64: string;
    mediaType: string;
  }) => Promise<string>;
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
  /**
   * Modelo (barato) para la expansión de consultas de research; cadena vacía = desactivada.
   * Es una micro-llamada auxiliar de research, no una etapa del catálogo.
   */
  queryExpansionModel: string;
  /**
   * Modelo de imagen de la etapa feature-image; cadena vacía = etapa desactivada. La etapa
   * además requiere que el tipo de noticia la active (enableFeatureImage).
   */
  featureImageModel: string;
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
  /** El artículo se guardó como borrador, pero agotó correcciones sin superar los jueces. */
  | "needs_review"
  | "failed"
  /** El usuario canceló la generación (abort del stream); no es un fallo del pipeline. */
  | "cancelled";

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
