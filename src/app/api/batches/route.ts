import type { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/authorize";
import { createBatch, getBatchesForUser, processBatch } from "@/lib/batch/worker";
import { generateRateLimiter } from "@/lib/http/rate-limit";
import { checkDailyBudget } from "@/lib/observability/cost-budget";
import { buildPipelineConfig, buildPipelineDeps } from "@/lib/pipeline/build-deps";
import { resolveNewsType } from "@/lib/settings/news-types";
import { createBatchSchema } from "@/lib/validation/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista los lotes del usuario con el estado de cada tema (la vista los sondea). */
export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }
  return Response.json(await getBatchesForUser(session.user.id));
}

/**
 * Crea un lote y arranca su procesamiento en segundo plano. El worker corre en el propio
 * proceso del servidor (fire-and-forget): la app se despliega como Node de larga vida.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  // Un lote dispara N generaciones: se aplican los mismos guardas que a una generación.
  if (!generateRateLimiter.check(session.user.id)) {
    return new Response("Demasiadas peticiones, inténtalo en un minuto.", { status: 429 });
  }
  const budget = await checkDailyBudget(session.user.id);
  if (!budget.allowed) {
    return new Response("Presupuesto diario de IA agotado.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createBatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  const [cfg, deps, newsType] = await Promise.all([
    buildPipelineConfig(),
    buildPipelineDeps(),
    resolveNewsType(parsed.data.newsTypeId),
  ]);

  const batchId = await createBatch({
    userId: session.user.id,
    name: parsed.data.name,
    topics: parsed.data.topics,
    budgetUsd: parsed.data.budgetUsd,
    newsTypeId: newsType.id,
  });

  // Fire-and-forget deliberado: la petición devuelve el id y la vista sondea el progreso.
  // Un fallo global del worker queda en el log de errores; los fallos por tema, en su item.
  void processBatch(batchId, { cfg, deps, newsType }).catch(() => {});

  return Response.json({ batchId }, { status: 202 });
}
