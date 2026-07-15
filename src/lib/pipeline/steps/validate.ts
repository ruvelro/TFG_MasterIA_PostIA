import { composeEditorialVoice, factsToText } from "@/lib/pipeline/format";
import {
  appendEditorialVoice,
  appendUserContext,
  renderTemplate,
} from "@/lib/pipeline/render-template";
import { sanitizeValidationReport } from "@/lib/pipeline/review-sanitizer";
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
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(
      renderTemplate(step.prompt, {
        topic: ctx.topic,
        draft: ctx.draft,
        facts: factsToText(ctx.facts),
        editorialVoice,
        seoRules: cfg.seoRules,
        geoRules: cfg.geoRules,
        revisionInstructions: ctx.revisionInstructions ?? "",
        context: ctx.context ?? "",
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
    schema: ValidationReportSchema,
  });
  return { report: sanitizeValidationReport(object), model: step.model, usage };
}
