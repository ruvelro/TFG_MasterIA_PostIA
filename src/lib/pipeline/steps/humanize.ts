import { aiToneReviewToText, composeEditorialVoice } from "@/lib/pipeline/format";
import { analyzeProseRhythm, proseRhythmToText } from "@/lib/pipeline/prose-rhythm";
import {
  appendEditorialVoice,
  appendUserContext,
  renderTemplate,
} from "@/lib/pipeline/render-template";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa humanize (IA): reescribe el borrador para eliminar patrones típicos de texto
 * generado por IA. Usa `runText` (salida libre) para no arriesgar truncado del artículo
 * al encajar en JSON. El resultado sustituye directamente al borrador anterior.
 */
export async function runHumanize(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ draft: string; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("humanize requiere el borrador de la etapa draft");

  const step = cfg.steps.humanize;
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(
      renderTemplate(step.prompt, {
        draft: ctx.draft,
        editorialVoice,
        styleIssues: aiToneReviewToText(ctx.report, ctx.qualityReport),
        proseRhythm: proseRhythmToText(analyzeProseRhythm(ctx.draft)),
        context: ctx.context ?? "",
      }),
      step.prompt,
      ctx.context,
    ),
    step.prompt,
    editorialVoice,
  );

  const { text, usage } = await deps.runText({ modelId: step.model, prompt });
  return { draft: text, model: step.model, usage };
}
