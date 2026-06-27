import { renderTemplate } from "@/lib/pipeline/render-template";
import { QualityReviewSchema, type QualityReview } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa quality-review (IA "juez"): evalúa la calidad del artículo con puntuaciones
 * numéricas. El `aiScore` (0-100) es la señal que desencadena la re-humanización
 * automática si supera el umbral configurado en `ResolvedPipelineConfig`.
 */
export async function runQualityReview(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ qualityReport: QualityReview; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("quality-review requiere el borrador de la etapa draft");

  const step = cfg.steps["quality-review"];
  const prompt = renderTemplate(step.prompt, {
    topic: ctx.topic,
    seoRules: cfg.seoRules,
    draft: ctx.draft,
  });

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: QualityReviewSchema,
  });
  return { qualityReport: object, model: step.model, usage };
}
