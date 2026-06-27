import { combinedReviewToText } from "@/lib/pipeline/format";
import { renderTemplate } from "@/lib/pipeline/render-template";
import { FixerOutputSchema, type FixerOutput } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa fixer (IA): corrige el borrador según el informe de validación, aplica formato
 * (negritas) y produce la meta SEO final (título, slug, meta description, keywords).
 * Su salida es el artículo final candidato; el orquestador puede volver a validarlo.
 */
export async function runFixer(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ article: FixerOutput; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("fixer requiere el borrador");
  if (!ctx.report) throw new Error("fixer requiere el informe de validación");

  const step = cfg.steps.fixer;
  const prompt = renderTemplate(step.prompt, {
    topic: ctx.topic,
    draft: ctx.draft,
    report: combinedReviewToText(ctx.report, ctx.factualReport, ctx.qualityReport),
    editorialVoice: cfg.editorialVoice,
    seoRules: cfg.seoRules,
  });

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: FixerOutputSchema,
  });
  return { article: object, model: step.model, usage };
}
