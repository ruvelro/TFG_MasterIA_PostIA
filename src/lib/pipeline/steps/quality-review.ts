import { renderTemplate } from "@/lib/pipeline/render-template";
import { analyzeProseRhythm, proseRhythmToText } from "@/lib/pipeline/prose-rhythm";
import { sanitizeQualityReview } from "@/lib/pipeline/review-sanitizer";
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
    currentDate: new Date().toISOString().slice(0, 10),
    aiScoreThreshold: String(cfg.aiScoreThreshold),
    seoRules: cfg.seoRules,
    geoRules: cfg.geoRules,
    proseRhythm: proseRhythmToText(analyzeProseRhythm(ctx.draft)),
    draft: ctx.draft,
  });

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: QualityReviewSchema,
  });
  return {
    qualityReport: sanitizeQualityReview(object, {
      draft: ctx.draft,
      aiScoreThreshold: cfg.aiScoreThreshold,
    }),
    model: step.model,
    usage,
  };
}
