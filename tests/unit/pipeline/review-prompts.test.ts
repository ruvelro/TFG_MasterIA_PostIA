import { describe, expect, it } from "vitest";

import { DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { runHumanize } from "@/lib/pipeline/steps/humanize";
import { runQualityReview } from "@/lib/pipeline/steps/quality-review";
import type { PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

const cfg = {
  steps: DEFAULT_STEP_CONFIG,
  editorialVoice: "Directa",
  seoRules: "SEO",
  geoRules: "GEO",
  aiScoreThreshold: 25,
} as ResolvedPipelineConfig;

describe("prompts de revisión editorial", () => {
  it("inyecta en humanize las incidencias ai-tone de la última validación", async () => {
    let capturedPrompt = "";
    const deps = {
      runText: async ({ prompt }: { prompt: string }) => {
        capturedPrompt = prompt;
        return { text: "Texto corregido", usage: {} };
      },
    } as unknown as PipelineDeps;

    await runHumanize(
      {
        topic: "Tema",
        sources: [],
        draft: "Texto original",
        report: {
          passed: false,
          issues: [
            {
              category: "ai-tone",
              severity: "medium",
              description: "Ese detalle puede pesar mucho",
              suggestion: "Explica la consecuencia concreta",
            },
          ],
        },
      },
      cfg,
      deps,
    );

    expect(capturedPrompt).toContain("Ese detalle puede pesar mucho");
    expect(capturedPrompt).toContain("Explica la consecuencia concreta");
  });

  it("inyecta en humanize el diagnóstico ai-tone de quality-review y excluye otras categorías", async () => {
    let capturedPrompt = "";
    const deps = {
      runText: async ({ prompt }: { prompt: string }) => {
        capturedPrompt = prompt;
        return { text: "Texto corregido", usage: {} };
      },
    } as unknown as PipelineDeps;

    await runHumanize(
      {
        topic: "Tema",
        sources: [],
        draft: "Texto original",
        report: { passed: true, issues: [] },
        qualityReport: {
          structureScore: 86,
          factualSupportScore: 90,
          seoScore: 84,
          wordCount: 900,
          aiScore: 38,
          issues: [
            {
              category: "ai-tone",
              description: "Encadena transiciones de manual",
              suggestion: "Elimina los conectores que solo ordenan el discurso",
            },
            {
              category: "structure",
              description: "Sobran dos secciones",
              suggestion: "Fusiona los bloques",
            },
          ],
          suggestions: [],
        },
      },
      cfg,
      deps,
    );

    expect(capturedPrompt).toContain("aiScore 38/100");
    expect(capturedPrompt).toContain("Encadena transiciones de manual");
    expect(capturedPrompt).not.toContain("Sobran dos secciones");
  });

  it("ancla quality-review a la fecha actual", async () => {
    let capturedPrompt = "";
    const deps = {
      runObject: async ({ prompt }: { prompt: string }) => {
        capturedPrompt = prompt;
        return {
          object: {
            structureScore: 80,
            factualSupportScore: 80,
            seoScore: 80,
            wordCount: 400,
            aiScore: 20,
            issues: [],
            suggestions: [],
          },
          usage: {},
        };
      },
    } as unknown as PipelineDeps;

    await runQualityReview({ topic: "Tema", sources: [], draft: "Artículo" }, cfg, deps);

    expect(capturedPrompt).toContain(new Date().toISOString().slice(0, 10));
    expect(capturedPrompt).toContain("umbral editorial de sabor IA es 25");
    expect(capturedPrompt).not.toContain("{{currentDate}}");
    expect(capturedPrompt).not.toContain("{{aiScoreThreshold}}");
  });
});
