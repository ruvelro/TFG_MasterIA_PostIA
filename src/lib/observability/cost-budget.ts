import { prisma } from "@/lib/db/client";
import { getAppSetting } from "@/lib/settings/app-config";
import { SETTING_KEYS } from "@/lib/settings/keys";

/**
 * Presupuesto diario de IA por usuario, en USD. El rate limit por peticiones acota el abuso
 * puntual, pero el recurso que de verdad importa es el COSTE: el sistema ya persiste
 * `costUsd` por etapa, así que un tope en dólares protege mejor la clave compartida que un
 * contador de peticiones. Se consulta al arrancar cada generación (start/resume/revise).
 *
 * La ventana es deslizante (últimas 24 h), no el día natural: evita que el presupuesto se
 * "reinicie" a medianoche y es más simple de razonar. Los runs aún en curso no cuentan (su
 * coste se persiste al finalizar): es una holgura asumida de como mucho un run.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Límite diario configurado por el admin (USD). 0 = sin límite (valor de fábrica). */
export async function getDailyCostLimitUsd(): Promise<number> {
  const raw = await getAppSetting(SETTING_KEYS.dailyCostLimitUsd);
  const value = Number.parseFloat(raw ?? "");
  if (Number.isNaN(value) || value < 0) return 0;
  return value;
}

/** Coste acumulado (USD) del usuario en las últimas 24 h, sumando sus etapas con coste. */
export async function getUserDailyCostUsd(userId: string): Promise<number> {
  const since = new Date(Date.now() - DAY_MS);
  const result = await prisma.generationStep.aggregate({
    _sum: { costUsd: true },
    where: { costUsd: { not: null }, createdAt: { gte: since }, run: { userId } },
  });
  return result._sum.costUsd ?? 0;
}

export interface BudgetCheck {
  allowed: boolean;
  limitUsd: number;
  spentUsd: number;
}

/** Comprueba si el usuario puede arrancar otra generación dentro de su presupuesto diario. */
export async function checkDailyBudget(userId: string): Promise<BudgetCheck> {
  const limitUsd = await getDailyCostLimitUsd();
  if (limitUsd <= 0) return { allowed: true, limitUsd, spentUsd: 0 };

  const spentUsd = await getUserDailyCostUsd(userId);
  return { allowed: spentUsd < limitUsd, limitUsd, spentUsd };
}
