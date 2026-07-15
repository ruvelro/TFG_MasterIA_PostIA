import { describe, expect, it } from "vitest";

import { DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { runFactualReview } from "@/lib/pipeline/steps/factual-review";
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
    expect(capturedPrompt).toContain("Diagnóstico determinista del ritmo del borrador");
    expect(capturedPrompt).toContain("Rompe estructuras demasiado simétricas");
    expect(capturedPrompt).toContain("ningún benchmark aislado");
    expect(capturedPrompt).not.toContain("{{proseRhythm}}");
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
    expect(capturedPrompt).toContain("tres o más secciones consecutivas");
    expect(capturedPrompt).toContain("porcentaje de mejora que omita su referencia");
    expect(capturedPrompt).toContain("sin suficientes párrafos de prosa para medir");
    expect(capturedPrompt).not.toContain("{{currentDate}}");
    expect(capturedPrompt).not.toContain("{{aiScoreThreshold}}");
    expect(capturedPrompt).not.toContain("{{proseRhythm}}");
  });

  it("quality-review no puede ignorar una cadencia determinísticamente uniforme", async () => {
    const draft = Array.from({ length: 9 }, (_unused, paragraph) =>
      Array.from({ length: 48 + (paragraph % 2) }, (_word, word) => `t${paragraph}-${word}`).join(
        " ",
      ),
    ).join("\n\n");
    const deps = {
      runObject: async () => ({
        object: {
          structureScore: 90,
          factualSupportScore: 90,
          seoScore: 90,
          wordCount: 436,
          aiScore: 8,
          issues: [],
          suggestions: [],
        },
        usage: {},
      }),
    } as unknown as PipelineDeps;

    const result = await runQualityReview({ topic: "Tema", sources: [], draft }, cfg, deps);

    expect(result.qualityReport.aiScore).toBe(25);
    expect(result.qualityReport.issues[0]).toMatchObject({ category: "ai-tone" });
  });

  it("factual-review recibe la procedencia y rebaja una extrapolación secundaria", async () => {
    let capturedPrompt = "";
    const deps = {
      runObject: async ({ prompt }: { prompt: string }) => {
        capturedPrompt = prompt;
        return {
          object: {
            riskLevel: "low",
            claims: [
              {
                claim: "Microsoft confirmó un paquete de 174 KB.",
                status: "confirmed",
                evidenceType: "inferred",
                sourceAuthority: "secondary",
                reason: "La cifra procede de una extrapolación periodística.",
              },
            ],
            summary: "La atribución excede la evidencia primaria.",
            researchSufficiency: { sufficient: true, reason: "Hay fuentes suficientes." },
          },
          usage: {},
        };
      },
    } as unknown as PipelineDeps;

    const result = await runFactualReview(
      {
        topic: "Windows 11 26H2",
        sources: [
          {
            title: "Cobertura sobre el paquete",
            url: "https://medio.example/26h2",
            snippet: "Extracto",
            content: "Contenido",
          },
        ],
        facts: {
          facts: [{ claim: "El medio estima 174 KB", source: "https://medio.example/26h2" }],
        },
        draft: "Microsoft confirmó un paquete de 174 KB.",
      },
      cfg,
      deps,
    );

    expect(capturedPrompt).toContain('titulo="Cobertura sobre el paquete"');
    expect(capturedPrompt).toContain('url="https://medio.example/26h2"');
    expect(capturedPrompt).toContain(new Date().toISOString().slice(0, 10));
    expect(capturedPrompt).toContain("reciente prevalece para el estado vigente");
    expect(capturedPrompt).toContain("Un porcentaje de mejora sin base comparativa");
    expect(capturedPrompt).toContain("No generalices el alcance de una prueba");
    expect(capturedPrompt).toContain("Solo una evidencia `direct` puede quedar `confirmed`");
    expect(capturedPrompt).not.toContain("{{currentDate}}");
    expect(capturedPrompt).not.toContain("{{sourceCatalog}}");
    expect(result.factualReport.claims[0].status).toBe("doubtful");
    expect(result.factualReport.riskLevel).toBe("medium");
  });

  it("el fixer conserva las correcciones temporales, comparativas y de estructura", () => {
    const prompt = DEFAULT_STEP_CONFIG.fixer.prompt;

    expect(prompt).toContain("conserva el estado más reciente respaldado");
    expect(prompt).toContain("porcentajes comparativos sin referente explícito");
    expect(prompt).toContain("un benchmark aislado no permite");
    expect(prompt).toContain("reorganiza el artículo por");
  });
});
