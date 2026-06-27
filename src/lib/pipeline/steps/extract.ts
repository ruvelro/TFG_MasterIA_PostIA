import { sourcesToText } from "@/lib/pipeline/format";
import { appendUserContext, renderTemplate } from "@/lib/pipeline/render-template";
import { FactsSchema, type Facts } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/** Etapa extract (IA): analiza las fuentes y saca los hechos clave con su cita. */
export async function runExtract(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ facts: Facts; model: string; usage: TokenUsage }> {
  const step = cfg.steps.extract;
  const prompt = appendUserContext(
    renderTemplate(step.prompt, {
      topic: ctx.topic,
      sources: sourcesToText(ctx.sources),
      context: ctx.context ?? "",
    }),
    step.prompt,
    ctx.context,
  );

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: FactsSchema,
  });
  return { facts: object, model: step.model, usage };
}
