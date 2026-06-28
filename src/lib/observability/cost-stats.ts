import { requireAdmin } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/client";

/**
 * Agrega el coste estimado por etapa (`GenerationStep.costUsd`, ya persistido) para el panel de
 * administración: total global, total del periodo reciente y desglose por usuario. La consulta
 * cruza datos de TODOS los usuarios, así que `getCostStats` exige rol admin por sí misma. El coste
 * se calcula en JS a partir de una única consulta para no recurrir a SQL crudo ni a varios
 * `groupBy`: el volumen (un TFM sobre SQLite) lo hace sobradamente suficiente.
 */

/** Coste acumulado de un usuario: nº de runs con coste y total en USD. */
export interface UserCostRow {
  userId: string;
  name: string;
  email: string;
  runs: number;
  totalUsd: number;
}

export interface CostStats {
  /** Total global (todo el histórico) en USD. */
  totalUsd: number;
  /** Total de los últimos `periodDays` días en USD. */
  periodUsd: number;
  periodDays: number;
  /** Desglose por usuario (todo el histórico), de mayor a menor coste. */
  byUser: UserCostRow[];
}

export async function getCostStats(periodDays = 30): Promise<CostStats> {
  // Defensa en profundidad: la consulta cruza datos de TODOS los usuarios, así que exigimos rol
  // admin aquí además del guard de la página (ningún caller puede saltarse la autorización).
  await requireAdmin();

  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Solo etapas con coste calculable; arrastramos el usuario del run para agrupar.
  const steps = await prisma.generationStep.findMany({
    where: { costUsd: { not: null } },
    select: {
      costUsd: true,
      createdAt: true,
      runId: true,
      run: { select: { userId: true, user: { select: { name: true, email: true } } } },
    },
  });

  let totalUsd = 0;
  let periodUsd = 0;
  // Acumulador por usuario; los runs se cuentan con un Set de runId para no inflar el total
  // cuando un mismo run tiene varias etapas con coste.
  const byUser = new Map<
    string,
    { name: string; email: string; total: number; runs: Set<string> }
  >();

  for (const step of steps) {
    const cost = step.costUsd ?? 0;
    totalUsd += cost;
    if (step.createdAt >= since) periodUsd += cost;

    const { userId, user } = step.run;
    const entry = byUser.get(userId) ?? {
      name: user.name,
      email: user.email,
      total: 0,
      runs: new Set<string>(),
    };
    entry.total += cost;
    entry.runs.add(step.runId);
    byUser.set(userId, entry);
  }

  const rows: UserCostRow[] = [...byUser.entries()]
    .map(([userId, e]) => ({
      userId,
      name: e.name,
      email: e.email,
      runs: e.runs.size,
      totalUsd: e.total,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  return { totalUsd, periodUsd, periodDays, byUser: rows };
}
