import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { findConfiguration } from "@/lib/eval/configurations";
import { JudgeVerdictSchema } from "@/lib/eval/judge";
import { judgeOverlapsPipeline, runEvalCase } from "@/lib/eval/runner";
import { DEFAULT_PIPELINE_PARAMS, DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { createFakePipelineDeps } from "@/lib/pipeline/fake-deps";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import type { PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

/**
 * El runner del harness se prueba con las dependencias FALSAS del pipeline (las mismas de
 * e2e) más un juez determinista: valida el flujo completo tema×configuración → EvalRecord
 * sin red ni claves. La calidad real de los modelos no se prueba aquí (es lo que mide el
 * harness en ejecución real); aquí se prueba que la medición es correcta.
 */

const baseCfg: ResolvedPipelineConfig = {
  steps: DEFAULT_STEP_CONFIG,
  editorialVoice: "Tono cercano",
  seoRules: "Keyword en el primer párrafo",
  geoRules: "Responde preguntas directas",
  sourceCount: 2,
  queryExpansionModel: "",
  featureImageModel: "",
  maxFixIterations: 1,
  maxHumanizeRetries: DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries,
  aiScoreThreshold: DEFAULT_PIPELINE_PARAMS.aiScoreThreshold,
  scrubPatterns: [...DEFAULT_SCRUB_PATTERNS],
  forbiddenWords: [],
  validatorConfig: DEFAULT_VALIDATOR_CONFIG,
};

/** Deps falsas del pipeline + juez determinista (interceptado por identidad del esquema). */
function makeEvalDeps(): PipelineDeps {
  const fake = createFakePipelineDeps();
  const runObject: PipelineDeps["runObject"] = async (params) => {
    if ((params.schema as unknown) === JudgeVerdictSchema) {
      return {
        object: {
          faithfulness: 85,
          structure: 80,
          style: 75,
          seo: 70,
          overall: 78,
          rationale: "Artículo sólido para ser un test.",
        } as never,
        usage: { inputTokens: 10, outputTokens: 10 },
      };
    }
    return fake.runObject(params);
  };
  return { ...fake, runObject, estimateCost: async () => 0.001 };
}

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Eval", email: `eval_${Date.now()}@postia.test` },
  });
  userId = user.id;
});

describe("runEvalCase", () => {
  it("modo pipeline: produce un registro completo con juez, métricas y coste", async () => {
    const record = await runEvalCase({
      golden: { id: "tema-test", topic: "Tema de prueba" },
      configuration: findConfiguration("iteraciones-1")!,
      baseCfg,
      deps: makeEvalDeps(),
      userId,
      judgeModel: "juez/independiente",
    });

    expect(record.status).toBe("completed");
    expect(record.configId).toBe("iteraciones-1");
    expect(record.mode).toBe("pipeline");
    expect(record.runId).toBeDefined();
    expect(record.judge?.overall).toBe(78);
    expect(record.metrics?.wordCount).toBeGreaterThan(0);
    expect(record.latencyMs).toBeGreaterThanOrEqual(0);
    expect(record.validationPassed).toBe(true);
    // El coste sale de la traza persistida del run.
    expect(record.costUsd).not.toBeNull();
  });

  it("modo single-call: línea base sin run persistido pero con juez y coste", async () => {
    const record = await runEvalCase({
      golden: { id: "tema-test", topic: "Tema de prueba" },
      configuration: findConfiguration("llamada-unica")!,
      baseCfg,
      deps: makeEvalDeps(),
      userId,
      judgeModel: "juez/independiente",
    });

    expect(record.status).toBe("completed");
    expect(record.mode).toBe("single-call");
    expect(record.runId).toBeUndefined();
    expect(record.judge?.overall).toBe(78);
    expect(record.costUsd).toBe(0.001);
    // La línea base no pasa por el bucle de calidad: no tiene validación del pipeline.
    expect(record.validationPassed).toBeUndefined();
  });

  it("un fallo se captura como registro de error, no como excepción", async () => {
    const deps = makeEvalDeps();
    deps.search = async () => {
      throw new Error("buscador caído");
    };
    const record = await runEvalCase({
      golden: { id: "tema-test", topic: "Tema de prueba" },
      configuration: findConfiguration("base")!,
      baseCfg,
      deps,
      userId,
      judgeModel: "juez/independiente",
    });
    expect(record.status).toBe("error");
    expect(record.error).toContain("buscador caído");
  });

  it("judgeOverlapsPipeline detecta el sesgo de auto-preferencia", () => {
    expect(judgeOverlapsPipeline(baseCfg, DEFAULT_STEP_CONFIG.draft.model)).toBe(true);
    expect(judgeOverlapsPipeline(baseCfg, "juez/independiente")).toBe(false);
  });
});
