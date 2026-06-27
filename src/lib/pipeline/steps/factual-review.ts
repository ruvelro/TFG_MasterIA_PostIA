import { factsToText } from "@/lib/pipeline/format";
import { renderTemplate } from "@/lib/pipeline/render-template";
import { FactualReviewSchema, type FactualReview } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa factual-review (IA "juez"): clasifica cada afirmación del artículo como
 * confirmada, dudosa o descartada, cotejándola con los hechos extraídos de las fuentes.
 * Produce un nivel de riesgo global que el orquestador y el fixer utilizan.
 */
export async function runFactualReview(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ factualReport: FactualReview; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("factual-review requiere el borrador de la etapa draft");
  if (!ctx.facts) throw new Error("factual-review requiere los hechos de la etapa extract");

  const step = cfg.steps["factual-review"];
  const prompt = renderTemplate(step.prompt, {
    topic: ctx.topic,
    facts: factsToText(ctx.facts),
    draft: ctx.draft,
  });

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: FactualReviewSchema,
  });
  return { factualReport: object, model: step.model, usage };
}
