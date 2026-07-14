import type { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/authorize";
import { streamJsonEvents } from "@/lib/http/event-stream";
import { indexArticleAndSuggestLinks } from "@/lib/embeddings/service";
import { generateRateLimiter } from "@/lib/http/rate-limit";
import { checkDailyBudget } from "@/lib/observability/cost-budget";
import { reviseGenerationForUser } from "@/lib/pipeline/service";
import type { GenerationStreamEvent } from "@/lib/pipeline/stream-events";
import { reviseGenerationSchema } from "@/lib/validation/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reenvío dirigido: revisa un artículo existente del usuario con unas instrucciones y transmite
 * el progreso en streaming. La PROPIEDAD del artículo se verifica dentro del servicio (la consulta
 * filtra por usuario), de modo que un artículo ajeno se trata como inexistente.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  if (!generateRateLimiter.check(session.user.id)) {
    return new Response("Demasiadas peticiones, inténtalo en un minuto.", { status: 429 });
  }

  // Presupuesto diario en USD (si el admin lo ha configurado): protege el coste real de IA,
  // no solo el número de peticiones.
  const budget = await checkDailyBudget(session.user.id);
  if (!budget.allowed) {
    return new Response(
      `Presupuesto diario de IA agotado (${budget.spentUsd.toFixed(2)} de ${budget.limitUsd.toFixed(2)} USD en 24 h).`,
      { status: 429 },
    );
  }

  const { id: articleId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = reviseGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  return streamJsonEvents<GenerationStreamEvent>(async (emit) => {
    const result = await reviseGenerationForUser(
      { userId: session.user.id, articleId, instructions: parsed.data.instructions },
      (event) => emit({ type: "stage", ...event }),
    );
    if (result.context.article) {
      emit({
        type: result.status === "needs_review" ? "needs_review" : "completed",
        runId: result.runId,
        articleId: result.articleId,
        article: result.context.article,
        enrichment: result.context.enrichment,
      });
      // Reindexa el artículo revisado: su embedding y sus enlaces pueden cambiar.
      if (result.status === "completed" && result.articleId) {
        void indexArticleAndSuggestLinks(result.articleId);
      }
    }
  });
}
