import { combinedReviewToText, composeEditorialVoice } from "@/lib/pipeline/format";
import {
  appendEditorialVoice,
  appendUserContext,
  renderTemplate,
} from "@/lib/pipeline/render-template";
import { ArticleMetadataSchema, FixerOutputSchema, type FixerOutput } from "@/lib/pipeline/schemas";
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
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(
      renderTemplate(step.prompt, {
        topic: ctx.topic,
        draft: ctx.draft,
        report: combinedReviewToText(ctx.report, ctx.factualReport, ctx.qualityReport),
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
    schema: FixerOutputSchema,
  });
  return { article: object, model: step.model, usage };
}

/**
 * Completa la metadata SEO sin volver a redactar el cuerpo. Antes se llamaba al fixer completo
 * incluso cuando el artículo ya estaba aprobado, lo que podía reintroducir patrones de IA después
 * de la última validación. El Markdown se conserva literalmente y solo se generan sus metadatos.
 */
export async function runArticleFinalizer(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<{ article: FixerOutput; model: string; usage: TokenUsage }> {
  if (!ctx.draft) throw new Error("finalizer requiere el artículo aprobado");

  const step = cfg.steps.fixer;
  const basePrompt = [
    "Eres un editor SEO. Genera únicamente los metadatos del artículo, sin reescribir ni devolver",
    "el cuerpo. El contenido ya ha sido corregido y aprobado editorialmente.",
    "- title: máximo 60 caracteres, natural y fiel al contenido.",
    "- slug: minúsculas, guiones y sin stopwords innecesarias.",
    "- metaDescription: máximo 155 caracteres, informativa y sin fórmulas promocionales.",
    "- keywords: lista breve de términos realmente presentes, sin repetición ni keyword stuffing.",
    "",
    `Tema: ${ctx.topic}`,
    "",
    "Artículo aprobado:",
    ctx.draft,
  ].join("\n");
  const editorialVoice = composeEditorialVoice(cfg.editorialVoice, ctx.newsType);
  const prompt = appendEditorialVoice(
    appendUserContext(basePrompt, "", ctx.context),
    "",
    editorialVoice,
  );

  const { object, usage } = await deps.runObject({
    modelId: step.model,
    prompt,
    schema: ArticleMetadataSchema,
  });

  return {
    article: { ...object, contentMarkdown: ctx.draft },
    model: step.model,
    usage,
  };
}
