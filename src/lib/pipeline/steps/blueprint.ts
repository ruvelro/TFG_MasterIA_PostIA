import {
  composeEditorialVoice,
  factsToText,
  newsTypeDirectivesToText,
} from "@/lib/pipeline/format";
import {
  appendEditorialVoice,
  appendUserContext,
  renderTemplate,
} from "@/lib/pipeline/render-template";
import { BlueprintSchema, type Blueprint } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/** Etapa blueprint (IA): diseña la estructura del artículo a partir de los hechos. */
export async function runBlueprint(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ blueprint: Blueprint; model: string; usage: TokenUsage }> {
  if (!ctx.facts) throw new Error("blueprint requiere los hechos de la etapa extract");

  const step = cfg.steps.blueprint;
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(
      renderTemplate(step.prompt, {
        topic: ctx.topic,
        facts: factsToText(ctx.facts),
        formatDirectives: newsTypeDirectivesToText(ctx.newsType, ctx.lengthPreset),
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
    schema: BlueprintSchema,
  });
  return { blueprint: object, model: step.model, usage };
}
