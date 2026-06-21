import { factsToText } from "@/lib/pipeline/format";
import { renderTemplate } from "@/lib/pipeline/render-template";
import { ValidationReportSchema, type ValidationReport } from "@/lib/pipeline/schemas";
import type {
  PipelineContext,
  PipelineDeps,
  ResolvedPipelineConfig,
  TokenUsage,
} from "@/lib/pipeline/types";

/**
 * Etapa validate (IA "juez"): revisa el borrador y devuelve un informe estructurado de
 * problemas (fidelidad a las fuentes, tono IA, reglas editoriales y SEO/GEO).
 */
export async function runValidate(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ report: ValidationReport; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("validate requiere el borrador de la etapa draft");
  if (!ctx.facts) throw new Error("validate requiere los hechos de la etapa extract");

  const step = cfg.steps.validate;
  const prompt = renderTemplate(step.prompt, {
    topic: ctx.topic,
    draft: ctx.draft,
    facts: factsToText(ctx.facts),
    editorialVoice: cfg.editorialVoice,
    seoRules: cfg.seoRules,
  });

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: ValidationReportSchema,
  });
  return { report: object, model: step.model, usage };
}
