import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { getCostStats } from "@/lib/observability/cost-stats";

let userId: string;

// Crea un run con sus etapas. `costs` es el costUsd de cada etapa (null = sin coste, p. ej. research).
async function createRun(costs: Array<number | null>): Promise<string> {
  const run = await prisma.generationRun.create({
    data: { userId, topic: "Coste", status: "completed" },
  });
  await prisma.generationStep.createMany({
    data: costs.map((costUsd, i) => ({
      runId: run.id,
      stageId: `stage-${i}`,
      status: "done",
      costUsd,
    })),
  });
  return run.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Coste User", email: `coste_${Date.now()}@postia.test` },
  });
  userId = user.id;
  // Dos runs: uno con 2 etapas con coste (+1 sin coste), otro con 1 etapa con coste.
  await createRun([0.001, 0.002, null]);
  await createRun([0.0005]);
});

describe("getCostStats", () => {
  it("agrega el coste del usuario contando runs distintos (no etapas)", async () => {
    const stats = await getCostStats(30);
    const row = stats.byUser.find((r) => r.userId === userId);

    expect(row).toBeDefined();
    // 2 runs con coste, no 3 etapas.
    expect(row?.runs).toBe(2);
    expect(row?.totalUsd).toBeCloseTo(0.0035, 10);
    expect(row?.email).toContain("@postia.test");
  });

  it("el total global incluye el aporte del usuario y el periodo lo refleja (datos recientes)", async () => {
    const stats = await getCostStats(30);

    expect(stats.totalUsd).toBeGreaterThanOrEqual(0.0035);
    // Los datos se han creado ahora, así que caen dentro de la ventana de 30 días.
    expect(stats.periodUsd).toBeGreaterThanOrEqual(0.0035);
    expect(stats.periodDays).toBe(30);
  });
});
