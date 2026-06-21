import { blueprintToText, factsToText } from "@/lib/pipeline/format";
import { renderTemplate } from "@/lib/pipeline/render-template";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa draft (IA): escribe el artículo en Markdown usando hechos + estructura + voz
 * editorial + reglas SEO/GEO. Genera texto libre (no estructurado).
 */
export async function runDraft(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ draft: string; model: string; usage: TokenUsage }> {
  if (!ctx.facts) throw new Error("draft requiere los hechos de la etapa extract");
  if (!ctx.blueprint) throw new Error("draft requiere la estructura de la etapa blueprint");

  const step = cfg.steps.draft;
  const prompt = renderTemplate(step.prompt, {
    topic: ctx.topic,
    facts: factsToText(ctx.facts),
    blueprint: blueprintToText(ctx.blueprint),
    editorialVoice: cfg.editorialVoice,
    seoRules: cfg.seoRules,
  });

  const { text, usage } = await deps.runText({ modelId: step.model, prompt });
  return { draft: text, model: step.model, usage };
}
