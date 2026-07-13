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

/**
 * Coste y tokens agregados de una dimensión (etapa o modelo). `steps` cuenta ejecuciones de
 * etapa (una etapa puede correr varias veces por el bucle de calidad), no runs. `avgUsdPerStep`
 * ayuda a comparar el coste unitario entre etapas/modelos con distinto volumen.
 */
export interface CostBreakdownRow {
  /** Clave de la dimensión: el `stageId` o el `model`. */
  key: string;
  steps: number;
  tokensInput: number;
  tokensOutput: number;
  totalUsd: number;
  avgUsdPerStep: number;
}

export interface CostBreakdown {
  /** Desglose por etapa del pipeline, de mayor a menor coste. */
  byStage: CostBreakdownRow[];
  /** Desglose por modelo de OpenRouter, de mayor a menor coste. */
  byModel: CostBreakdownRow[];
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

/** Acumulador interno de una fila del desglose, antes de calcular la media. */
interface BreakdownAccumulator {
  steps: number;
  tokensInput: number;
  tokensOutput: number;
  totalUsd: number;
}

function toSortedRows(acc: Map<string, BreakdownAccumulator>): CostBreakdownRow[] {
  return [...acc.entries()]
    .map(([key, e]) => ({
      key,
      steps: e.steps,
      tokensInput: e.tokensInput,
      tokensOutput: e.tokensOutput,
      totalUsd: e.totalUsd,
      avgUsdPerStep: e.steps > 0 ? e.totalUsd / e.steps : 0,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

/**
 * Desglosa el coste y los tokens por ETAPA y por MODELO a partir de la traza persistida
 * (`GenerationStep`). Responde a la pregunta de arquitectura del TFM ("¿dónde se va el coste y
 * qué modelo lo genera?") con datos reales. Exige rol admin por sí misma: cruza datos de todos
 * los usuarios. Se agrega en JS desde una sola consulta (volumen de un TFM sobre SQLite).
 */
export async function getCostBreakdown(): Promise<CostBreakdown> {
  await requireAdmin();

  const steps = await prisma.generationStep.findMany({
    where: { costUsd: { not: null } },
    select: { stageId: true, model: true, costUsd: true, tokensInput: true, tokensOutput: true },
  });

  const byStage = new Map<string, BreakdownAccumulator>();
  const byModel = new Map<string, BreakdownAccumulator>();

  const bump = (
    acc: Map<string, BreakdownAccumulator>,
    key: string,
    step: (typeof steps)[number],
  ) => {
    const entry = acc.get(key) ?? { steps: 0, tokensInput: 0, tokensOutput: 0, totalUsd: 0 };
    entry.steps += 1;
    entry.tokensInput += step.tokensInput ?? 0;
    entry.tokensOutput += step.tokensOutput ?? 0;
    entry.totalUsd += step.costUsd ?? 0;
    acc.set(key, entry);
  };

  for (const step of steps) {
    bump(byStage, step.stageId, step);
    // Un paso con coste siempre tiene modelo, pero por robustez lo etiquetamos si faltara.
    bump(byModel, step.model ?? "(desconocido)", step);
  }

  return { byStage: toSortedRows(byStage), byModel: toSortedRows(byModel) };
}
