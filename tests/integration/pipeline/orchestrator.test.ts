import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { resumeGeneration, startGeneration } from "@/lib/pipeline/orchestrator";
import {
  BlueprintSchema,
  FactsSchema,
  FixerOutputSchema,
  ValidationReportSchema,
} from "@/lib/pipeline/schemas";
import type { PipelineContext, PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

// Configuración resuelta de prueba (usa los prompts/modelos por defecto, que no se llaman
// de verdad porque las dependencias están mockeadas).
function makeConfig(maxFixIterations = 2): ResolvedPipelineConfig {
  return {
    steps: DEFAULT_STEP_CONFIG,
    editorialVoice: "Tono cercano",
    seoRules: "Usa la keyword en el primer párrafo",
    sourceCount: 2,
    maxFixIterations,
  };
}

// Dependencias falsas y deterministas. `runObject` decide la respuesta por IDENTIDAD del
// esquema (los steps pasan exactamente estos objetos de esquema), lo que evita acoplarse al
// orden de las llamadas (relevante por el bucle validate↔fixer).
function makeDeps(options: { validatePasses: boolean }): PipelineDeps {
  const runObject: PipelineDeps["runObject"] = async ({ schema }) => {
    // Comparamos por identidad de esquema (cast a unknown porque el genérico T y los
    // esquemas concretos no se "solapan" para TypeScript, pero en runtime son los mismos objetos).
    const s = schema as unknown;
    let object: unknown;
    if (s === FactsSchema) {
      object = { facts: [{ claim: "Un hecho", source: "https://e.example/0" }] };
    } else if (s === BlueprintSchema) {
      object = {
        title: "Titular",
        angle: "Ángulo",
        targetKeyword: "kw",
        sections: [{ heading: "H", summary: "S" }],
      };
    } else if (s === ValidationReportSchema) {
      object = options.validatePasses
        ? { passed: true, issues: [] }
        : {
            passed: false,
            issues: [{ category: "ai-tone", severity: "low", description: "d", suggestion: "s" }],
          };
    } else if (s === FixerOutputSchema) {
      object = {
        contentMarkdown: "# Final\n**clave**",
        title: "Final",
        slug: "final",
        metaDescription: "meta",
        keywords: ["kw"],
      };
    } else {
      throw new Error("esquema inesperado en el test");
    }
    return { object: object as never, usage: { inputTokens: 1, outputTokens: 1 } };
  };

  return {
    search: async (_query, limit) =>
      Array.from({ length: limit }, (_unused, index) => ({
        title: `Fuente ${index}`,
        url: `https://e.example/${index}`,
        snippet: `extracto ${index}`,
      })),
    fetchContent: async (url) => `contenido descargado de ${url}`,
    runText: async () => ({
      text: "# Borrador\nTexto del borrador",
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
    runObject,
  };
}

let userId: string;

beforeAll(async () => {
  // Better Auth gestiona las credenciales en otra tabla; para el test basta un User mínimo.
  const user = await prisma.user.create({
    data: { name: "Test", email: `orch_${Date.now()}@postia.test` },
  });
  userId = user.id;
});

describe("orquestador del pipeline", () => {
  it("recorre las 6 etapas y crea el artículo (sin pausa, validación pasa)", async () => {
    const result = await startGeneration({
      userId,
      topic: "Energía solar",
      pauseForReview: false,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(result.status).toBe("completed");

    const steps = await prisma.generationStep.findMany({ where: { runId: result.runId } });
    const stageIds = steps.map((s) => s.stageId);
    expect(stageIds).toEqual(
      expect.arrayContaining(["research", "extract", "blueprint", "draft", "validate", "fixer"]),
    );

    const article = await prisma.article.findFirst({ where: { runId: result.runId } });
    expect(article?.title).toBe("Final");
    expect(JSON.parse(article?.keywords ?? "[]")).toEqual(["kw"]);
  });

  it("se pausa tras la extracción y se reanuda con los hechos editados", async () => {
    const started = await startGeneration({
      userId,
      topic: "Coches eléctricos",
      pauseForReview: true,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(started.status).toBe("awaiting_review");
    expect(started.context.facts).toBeDefined();
    // Aún no hay artículo mientras está en revisión.
    expect(await prisma.article.findFirst({ where: { runId: started.runId } })).toBeNull();

    const editedFacts = {
      facts: [{ claim: "Hecho editado por el usuario", source: "https://e.example/0" }],
    };
    const resumed = await resumeGeneration({
      runId: started.runId,
      editedFacts,
      cfg: makeConfig(),
      deps: makeDeps({ validatePasses: true }),
    });

    expect(resumed.status).toBe("completed");
    const run = await prisma.generationRun.findUniqueOrThrow({ where: { id: started.runId } });
    const savedCtx = JSON.parse(run.contextJson ?? "{}") as PipelineContext;
    expect(savedCtx.facts?.facts[0].claim).toBe("Hecho editado por el usuario");
  });

  it("itera el bucle validate↔fixer cuando la validación no pasa", async () => {
    const result = await startGeneration({
      userId,
      topic: "Cambio climático",
      pauseForReview: false,
      cfg: makeConfig(2),
      deps: makeDeps({ validatePasses: false }),
    });

    expect(result.status).toBe("completed");
    const validateSteps = await prisma.generationStep.findMany({
      where: { runId: result.runId, stageId: "validate" },
    });
    // Con maxFixIterations=2 y validación que nunca pasa, debe validar 2 veces.
    expect(validateSteps.length).toBe(2);
    const attempts = validateSteps.map((s) => s.attempt).sort();
    expect(attempts).toEqual([1, 2]);
  });
});
