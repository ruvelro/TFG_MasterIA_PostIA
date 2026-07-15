import { DEFAULT_ARTICLE_LANGUAGE } from "@/lib/pipeline/language";
import { composeEditorialVoice } from "@/lib/pipeline/format";
import {
  appendEditorialVoice,
  appendUserContext,
  renderTemplate,
} from "@/lib/pipeline/render-template";
import { EnrichStepOutputSchema, type EnrichStepOutput } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa enrich (IA): genera el material SEO complementario del artículo una vez que el
 * texto es definitivo (post-scrub). Produce los campos creativos que el orquestador
 * combinará con las métricas derivadas (aiDetection, qualitySummary) para formar el
 * `ArticleEnrichment` completo.
 */
export async function runEnrich(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ enrichStepOutput: EnrichStepOutput; model: string; usage: TokenUsage }> {
  if (!ctx.article) throw new Error("enrich requiere el artículo final de la etapa fixer");
  if (!ctx.blueprint) throw new Error("enrich requiere el blueprint para la keyword objetivo");

  const step = cfg.steps.enrich;
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(
      renderTemplate(step.prompt, {
        topic: ctx.topic,
        targetKeyword: ctx.blueprint.targetKeyword,
        article: ctx.article.contentMarkdown,
        language: ctx.language ?? DEFAULT_ARTICLE_LANGUAGE,
        context: ctx.context ?? "",
        editorialVoice,
      }),
      step.prompt,
      ctx.context,
    ),
    step.prompt,
    editorialVoice,
  );

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: EnrichStepOutputSchema,
  });
  return { enrichStepOutput: object, model: step.model, usage };
}
