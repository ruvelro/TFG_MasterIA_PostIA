import { beforeAll, describe, expect, it } from "vitest";

import { createBatch, getBatchesForUser, processBatch } from "@/lib/batch/worker";
import { prisma } from "@/lib/db/client";
import { DEFAULT_PIPELINE_PARAMS, DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";
import { createFakePipelineDeps } from "@/lib/pipeline/fake-deps";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import type { PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

/**
 * El worker de lotes se prueba con las dependencias falsas del pipeline: cada tema recorre
 * una generación completa real (orquestador + BD) sin red. El coste se inyecta con un
 * estimateCost determinista para poder probar el control de presupuesto.
 */

const cfg: ResolvedPipelineConfig = {
  steps: DEFAULT_STEP_CONFIG,
  editorialVoice: "Voz",
  seoRules: "SEO",
  geoRules: "GEO",
  sourceCount: 1,
  queryExpansionModel: "",
  featureImageModel: "",
  maxFixIterations: 1,
  maxHumanizeRetries: DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries,
  aiScoreThreshold: DEFAULT_PIPELINE_PARAMS.aiScoreThreshold,
  scrubPatterns: [...DEFAULT_SCRUB_PATTERNS],
  forbiddenWords: [],
  validatorConfig: DEFAULT_VALIDATOR_CONFIG,
};

/** Deps falsas con coste fijo por etapa, para que cada run del lote cueste > 0. */
function makeDeps(costPerStage: number): PipelineDeps {
  return {
    ...createFakePipelineDeps(),
    estimateCost: async (model) => (model ? costPerStage : null),
  };
}

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Lotes", email: `batch_${Date.now()}@postia.test` },
  });
  userId = user.id;
});

describe("worker de lotes", () => {
  it("procesa todos los temas y deja los artículos como borradores del usuario", async () => {
    const batchId = await createBatch({
      userId,
      name: "Lote completo",
      topics: ["Tema uno", "Tema dos"],
      budgetUsd: 0,
    });
    await processBatch(batchId, { cfg, deps: makeDeps(0.0001) });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: { items: true },
    });
    expect(batch.status).toBe("completed");
    expect(batch.items.map((i) => i.status)).toEqual(["completed", "completed"]);
    expect(batch.items.every((i) => i.articleId)).toBe(true);
    expect(batch.items.every((i) => (i.costUsd ?? 0) > 0)).toBe(true);

    // Los artículos existen y pertenecen al usuario del lote.
    for (const item of batch.items) {
      const article = await prisma.article.findUnique({ where: { id: item.articleId! } });
      expect(article?.userId).toBe(userId);
    }
  });

  it("se detiene al agotar el presupuesto del lote y marca el resto como skipped", async () => {
    // Cada run cuesta bastante más que el presupuesto: tras el primer tema se corta.
    const batchId = await createBatch({
      userId,
      name: "Lote con presupuesto",
      topics: ["Caro uno", "Caro dos", "Caro tres"],
      budgetUsd: 0.005,
    });
    await processBatch(batchId, { cfg, deps: makeDeps(0.01) });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    expect(batch.status).toBe("completed");
    expect(batch.items[0].status).toBe("completed");
    expect(batch.items.slice(1).map((i) => i.status)).toEqual(["skipped", "skipped"]);
    expect(batch.items[1].error).toContain("Presupuesto del lote agotado");
  });

  it("una cancelación previa deja los temas pendientes como skipped", async () => {
    const batchId = await createBatch({
      userId,
      name: "Lote cancelado",
      topics: ["No debería generarse"],
      budgetUsd: 0,
    });
    await prisma.batch.update({ where: { id: batchId }, data: { status: "cancelled" } });
    await processBatch(batchId, { cfg, deps: makeDeps(0.0001) });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: { items: true },
    });
    expect(batch.status).toBe("cancelled");
    expect(batch.items[0].status).toBe("pending"); // processBatch ni siquiera lo tocó
  });

  it("la cancelación durante el procesamiento salta los temas restantes", async () => {
    const batchId = await createBatch({
      userId,
      name: "Cancelación en marcha",
      topics: ["Primero", "Segundo"],
      budgetUsd: 0,
    });
    // Cancela el lote en cuanto el primer tema empiece a investigar.
    const deps = makeDeps(0.0001);
    const originalSearch = deps.search;
    deps.search = async (...args) => {
      await prisma.batch.update({ where: { id: batchId }, data: { status: "cancelled" } });
      return originalSearch(...args);
    };
    await processBatch(batchId, { cfg, deps });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    // El primer tema (en curso) termina; el segundo se salta por la cancelación.
    expect(batch.items[0].status).toBe("completed");
    expect(batch.items[1].status).toBe("skipped");
    expect(batch.items[1].error).toContain("cancelado");
  });

  it("un tema fallido no interrumpe el resto del lote", async () => {
    const deps = makeDeps(0.0001);
    const originalSearch = deps.search;
    let calls = 0;
    deps.search = async (...args) => {
      calls += 1;
      if (calls === 1) throw new Error("buscador caído");
      return originalSearch(...args);
    };

    const batchId = await createBatch({
      userId,
      name: "Lote con fallo",
      topics: ["Falla", "Funciona"],
      budgetUsd: 0,
    });
    await processBatch(batchId, { cfg, deps });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    expect(batch.status).toBe("completed");
    expect(batch.items[0].status).toBe("failed");
    expect(batch.items[0].error).toContain("buscador caído");
    expect(batch.items[1].status).toBe("completed");
  });

  it("getBatchesForUser devuelve solo los lotes del usuario", async () => {
    const other = await prisma.user.create({
      data: { name: "Otro", email: `batch_otro_${Date.now()}@postia.test` },
    });
    await createBatch({ userId: other.id, name: "Ajeno", topics: ["x"], budgetUsd: 0 });

    const mine = await getBatchesForUser(userId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.userId === userId)).toBe(true);
  });
});
