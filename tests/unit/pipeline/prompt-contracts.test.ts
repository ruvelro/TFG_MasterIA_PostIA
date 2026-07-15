import { describe, expect, it } from "vitest";

import { AI_STAGE_IDS, type AiStageId, type StepConfig } from "@/lib/pipeline/default-config";
import { runBlueprint } from "@/lib/pipeline/steps/blueprint";
import { runDraft } from "@/lib/pipeline/steps/draft";
import { runEnrich } from "@/lib/pipeline/steps/enrich";
import { runExtract } from "@/lib/pipeline/steps/extract";
import { runFactualReview } from "@/lib/pipeline/steps/factual-review";
import { runArticleFinalizer, runFixer } from "@/lib/pipeline/steps/fixer";
import { runHumanize } from "@/lib/pipeline/steps/humanize";
import { runQualityReview } from "@/lib/pipeline/steps/quality-review";
import { runValidate } from "@/lib/pipeline/steps/validate";
import type { PipelineContext, PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

const steps = Object.fromEntries(
  AI_STAGE_IDS.map((stageId) => [
    stageId,
    { model: `modelo/${stageId}`, prompt: `Prompt personalizado de ${stageId} sin variables` },
  ]),
) as Record<AiStageId, StepConfig>;

const cfg = {
  steps,
  editorialVoice: "VOZ EDITORIAL IRRENUNCIABLE",
  seoRules: "",
  geoRules: "",
  aiScoreThreshold: 25,
} as ResolvedPipelineConfig;

const context: PipelineContext = {
  topic: "Tema",
  context: "DATO CONTEXTUAL IRRENUNCIABLE",
  sources: [],
  facts: { facts: [{ claim: "Hecho", source: "contexto adicional del usuario" }] },
  blueprint: {
    title: "Titular",
    angle: "Ángulo",
    readerPromise: "Promesa",
    mainThesis: "Tesis",
    leadAngle: "Entradilla",
    excludeOrCompress: [],
    targetKeyword: "keyword",
    sections: [{ heading: "Sección", summary: "Resumen" }],
  },
  draft: "Borrador periodístico.",
  report: { passed: true, issues: [] },
  factualReport: {
    riskLevel: "low",
    claims: [],
    summary: "Correcto",
    researchSufficiency: { sufficient: true, reason: "Suficiente" },
  },
  qualityReport: {
    structureScore: 90,
    factualSupportScore: 90,
    seoScore: 90,
    wordCount: 100,
    aiScore: 5,
    issues: [],
    suggestions: [],
  },
  article: {
    title: "Titular",
    slug: "titular",
    metaDescription: "Descripción",
    keywords: ["keyword"],
    contentMarkdown: "Artículo final.",
  },
};

const blueprintOutput = context.blueprint!;
const fixerOutput = context.article!;
const factualOutput = context.factualReport!;
const qualityOutput = context.qualityReport!;

function textDeps(prompts: Map<string, string>, stage: string): PipelineDeps {
  return {
    runText: async ({ prompt }) => {
      prompts.set(stage, prompt);
      return { text: "Texto", usage: {} };
    },
  } as PipelineDeps;
}

function objectDeps<T>(prompts: Map<string, string>, stage: string, object: T): PipelineDeps {
  return {
    runObject: async ({ prompt }) => {
      prompts.set(stage, prompt);
      return { object, usage: {} };
    },
  } as PipelineDeps;
}

describe("contratos de contexto y voz por etapa", () => {
  it("los aplica aunque todos los prompts personalizados omitan sus marcadores", async () => {
    const prompts = new Map<string, string>();

    await runExtract(context, cfg, objectDeps(prompts, "extract", context.facts!));
    await runBlueprint(context, cfg, objectDeps(prompts, "blueprint", blueprintOutput));
    await runDraft(context, cfg, textDeps(prompts, "draft"));
    await runHumanize(context, cfg, textDeps(prompts, "humanize"));
    await runValidate(context, cfg, objectDeps(prompts, "validate", { passed: true, issues: [] }));
    await runFactualReview(context, cfg, objectDeps(prompts, "factual-review", factualOutput));
    await runQualityReview(context, cfg, objectDeps(prompts, "quality-review", qualityOutput));
    await runFixer(context, cfg, objectDeps(prompts, "fixer", fixerOutput));
    await runArticleFinalizer(context, cfg, objectDeps(prompts, "finalizer", fixerOutput));
    await runEnrich(
      context,
      cfg,
      objectDeps(prompts, "enrich", {
        headlineVariants: ["Titular"],
        tags: ["tag"],
        faq: [],
        imageAlt: ["Descripción"],
        featuredImagePrompt: "Editorial image",
      }),
    );

    for (const stage of [
      "extract",
      "blueprint",
      "draft",
      "humanize",
      "validate",
      "factual-review",
      "quality-review",
      "fixer",
      "finalizer",
      "enrich",
    ]) {
      expect(prompts.get(stage), `${stage} debe recibir el contexto`).toContain(
        "DATO CONTEXTUAL IRRENUNCIABLE",
      );
      expect(prompts.get(stage)).toContain("CONTRATO DE CONTEXTO DEL USUARIO (OBLIGATORIO)");
    }

    for (const stage of [
      "blueprint",
      "draft",
      "humanize",
      "validate",
      "quality-review",
      "fixer",
      "finalizer",
      "enrich",
    ]) {
      expect(prompts.get(stage), `${stage} debe recibir la voz`).toContain(
        "VOZ EDITORIAL IRRENUNCIABLE",
      );
      expect(prompts.get(stage)).toContain("CONTRATO DE VOZ EDITORIAL (OBLIGATORIO)");
    }
  });
});
