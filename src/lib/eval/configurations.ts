import { AI_STAGE_IDS } from "@/lib/pipeline/default-config";
import type { NewsType } from "@/lib/pipeline/schemas";
import type { ResolvedPipelineConfig } from "@/lib/pipeline/types";

/**
 * Configuraciones comparadas por el harness de evaluación. Cada una transforma la
 * configuración base (la real del admin) en la variante a medir, de modo que la pregunta
 * central del TFM ("¿aporta el pipeline multi-etapa frente a una sola llamada?") se responde
 * con datos: calidad, coste y latencia por configuración sobre el mismo conjunto de temas.
 */

/** Modelo económico al que se fuerzan todas las etapas en la variante barata. */
export const ECONOMY_MODEL = "google/gemini-2.5-flash";

/** Tipo de noticia sintético para la variante sin humanización (resto de etapas intactas). */
const NO_HUMANIZE_TYPE: NewsType = {
  id: "eval-sin-humanize",
  label: "Eval sin humanize",
  description: "Variante de evaluación con la humanización desactivada",
  enableHumanize: false,
  enableFactualReview: true,
  enableQualityReview: true,
  sourceStrict: false,
  structureInstruction: "",
  targetWordCount: 0,
  voiceBrand: "",
  voiceHouseRules: "",
  voiceExamples: [],
  freshnessDays: 0,
};

export interface EvalConfiguration {
  id: string;
  description: string;
  /**
   * "pipeline": generación completa vía orquestador. "single-call": línea base con la misma
   * investigación pero UNA única llamada de redacción (sin etapas de calidad).
   */
  mode: "pipeline" | "single-call";
  /** Transforma la configuración base del admin en la variante a medir. */
  apply(base: ResolvedPipelineConfig): ResolvedPipelineConfig;
  /** Tipo de noticia que se pasa a la generación (activa/desactiva etapas opcionales). */
  newsType?: NewsType;
}

/** Fuerza el mismo modelo en todas las etapas de IA, conservando los prompts. */
function withUniformModel(base: ResolvedPipelineConfig, model: string): ResolvedPipelineConfig {
  const steps = { ...base.steps };
  for (const stageId of AI_STAGE_IDS) {
    steps[stageId] = { ...steps[stageId], model };
  }
  return { ...base, steps, queryExpansionModel: base.queryExpansionModel ? model : "" };
}

export const EVAL_CONFIGURATIONS: readonly EvalConfiguration[] = [
  {
    id: "base",
    description: "Configuración del admin tal cual (referencia de producción)",
    mode: "pipeline",
    apply: (base) => base,
  },
  {
    id: "economico",
    description: `Todas las etapas con el modelo económico (${ECONOMY_MODEL})`,
    mode: "pipeline",
    apply: (base) => withUniformModel(base, ECONOMY_MODEL),
  },
  {
    id: "sin-humanize",
    description: "Como base, pero sin la etapa de humanización",
    mode: "pipeline",
    apply: (base) => base,
    newsType: NO_HUMANIZE_TYPE,
  },
  {
    id: "iteraciones-1",
    description: "Como base, con una única pasada del bucle de calidad",
    mode: "pipeline",
    apply: (base) => ({ ...base, maxFixIterations: 1 }),
  },
  {
    id: "iteraciones-3",
    description: "Como base, con hasta tres pasadas del bucle de calidad",
    mode: "pipeline",
    apply: (base) => ({ ...base, maxFixIterations: 3 }),
  },
  {
    id: "llamada-unica",
    description: "Línea base: misma investigación, una sola llamada de redacción",
    mode: "single-call",
    apply: (base) => base,
  },
] as const;

export function findConfiguration(id: string): EvalConfiguration | undefined {
  return EVAL_CONFIGURATIONS.find((configuration) => configuration.id === id);
}
