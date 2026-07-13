import { beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/client";
import { getCostBreakdown, getCostStats } from "@/lib/observability/cost-stats";

// getCostStats exige rol admin (defensa en profundidad). Aquí probamos la AGREGACIÓN, no la
// autorización, así que dejamos requireAdmin como un no-op (no hay contexto de request en el test).
vi.mock("@/lib/auth/authorize", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin-test", role: "admin" } }),
}));

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

describe("getCostBreakdown", () => {
  it("agrega coste y tokens por etapa y por modelo, con coste medio por ejecución", async () => {
    // Etapas con stageId y modelo propios para asertar sobre filas concretas sin depender del
    // resto de datos del fichero de test.
    const run = await prisma.generationRun.create({
      data: { userId, topic: "Desglose", status: "completed" },
    });
    await prisma.generationStep.createMany({
      data: [
        {
          runId: run.id,
          stageId: "bd-draft",
          model: "modelo/x",
          status: "done",
          costUsd: 0.01,
          tokensInput: 100,
          tokensOutput: 200,
        },
        {
          runId: run.id,
          stageId: "bd-draft",
          model: "modelo/x",
          status: "done",
          costUsd: 0.03,
          tokensInput: 300,
          tokensOutput: 400,
        },
        {
          runId: run.id,
          stageId: "bd-validate",
          model: "modelo/y",
          status: "done",
          costUsd: 0.02,
          tokensInput: 50,
          tokensOutput: 60,
        },
      ],
    });

    const breakdown = await getCostBreakdown();

    const draft = breakdown.byStage.find((r) => r.key === "bd-draft");
    expect(draft?.steps).toBe(2);
    expect(draft?.totalUsd).toBeCloseTo(0.04, 10);
    expect(draft?.tokensInput).toBe(400);
    expect(draft?.tokensOutput).toBe(600);
    expect(draft?.avgUsdPerStep).toBeCloseTo(0.02, 10);

    const modelX = breakdown.byModel.find((r) => r.key === "modelo/x");
    expect(modelX?.steps).toBe(2);
    expect(modelX?.totalUsd).toBeCloseTo(0.04, 10);

    // Ambos desgloses están ordenados de mayor a menor coste total.
    const stageCosts = breakdown.byStage.map((r) => r.totalUsd);
    expect([...stageCosts]).toEqual([...stageCosts].sort((a, b) => b - a));
  });
});
