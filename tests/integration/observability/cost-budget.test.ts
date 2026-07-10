import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { checkDailyBudget, getUserDailyCostUsd } from "@/lib/observability/cost-budget";
import { setAppSetting } from "@/lib/settings/app-config";
import { SETTING_KEYS } from "@/lib/settings/keys";

let userId: string;
let otherUserId: string;

async function createRunWithCost(
  owner: string,
  costUsd: number,
  createdAt = new Date(),
): Promise<void> {
  const run = await prisma.generationRun.create({
    data: { userId: owner, topic: "Presupuesto", status: "completed" },
  });
  await prisma.generationStep.create({
    data: { runId: run.id, stageId: "draft", status: "done", costUsd, createdAt },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Budget User", email: `budget_${Date.now()}@postia.test` },
  });
  const other = await prisma.user.create({
    data: { name: "Otro", email: `budget_otro_${Date.now()}@postia.test` },
  });
  userId = user.id;
  otherUserId = other.id;

  await createRunWithCost(userId, 0.4);
  await createRunWithCost(userId, 0.3);
  // Fuera de la ventana de 24 h: no debe contar.
  await createRunWithCost(userId, 5, new Date(Date.now() - 25 * 60 * 60 * 1000));
  // De otro usuario: no debe contar.
  await createRunWithCost(otherUserId, 9);
});

describe("presupuesto diario de coste (A6)", () => {
  it("suma solo el gasto del usuario en las últimas 24 h", async () => {
    expect(await getUserDailyCostUsd(userId)).toBeCloseTo(0.7, 10);
  });

  it("sin límite configurado (0), siempre permite", async () => {
    await setAppSetting(SETTING_KEYS.dailyCostLimitUsd, "0");
    const budget = await checkDailyBudget(userId);
    expect(budget.allowed).toBe(true);
    expect(budget.limitUsd).toBe(0);
  });

  it("bloquea cuando el gasto de 24 h alcanza el límite", async () => {
    await setAppSetting(SETTING_KEYS.dailyCostLimitUsd, "0.5");
    const budget = await checkDailyBudget(userId);
    expect(budget.allowed).toBe(false);
    expect(budget.spentUsd).toBeCloseTo(0.7, 10);
    expect(budget.limitUsd).toBe(0.5);
  });

  it("permite mientras el gasto está por debajo del límite", async () => {
    await setAppSetting(SETTING_KEYS.dailyCostLimitUsd, "10");
    expect((await checkDailyBudget(userId)).allowed).toBe(true);
    // El gasto de otro usuario no consume el presupuesto de este.
    expect((await checkDailyBudget(otherUserId)).spentUsd).toBeCloseTo(9, 10);
  });

  it("un valor de límite inválido se trata como sin límite", async () => {
    await setAppSetting(SETTING_KEYS.dailyCostLimitUsd, "no-numérico");
    expect((await checkDailyBudget(userId)).allowed).toBe(true);
  });
});
