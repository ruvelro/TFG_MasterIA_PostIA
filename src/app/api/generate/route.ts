import type { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/authorize";
import { streamJsonEvents } from "@/lib/http/event-stream";
import { generateRateLimiter } from "@/lib/http/rate-limit";
import { startGenerationForUser } from "@/lib/pipeline/service";
import type { GenerationStreamEvent } from "@/lib/pipeline/stream-events";
import { startGenerationSchema } from "@/lib/validation/generation";

// El pipeline accede a la BD y a servicios externos: runtime Node y siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia una generación y transmite el progreso en streaming (NDJSON). Verifica sesión,
 * limita la tasa por usuario (coste de IA) y valida la entrada antes de tocar el pipeline.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  if (!generateRateLimiter.check(session.user.id)) {
    return new Response("Demasiadas peticiones, inténtalo en un minuto.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  const userId = session.user.id;
  const {
    topic,
    context,
    pauseForReview,
    pauseForBlueprintReview,
    newsTypeId,
    lengthPresetId,
    overrides,
  } = parsed.data;

  return streamJsonEvents<GenerationStreamEvent>(async (emit) => {
    const result = await startGenerationForUser(
      {
        userId,
        topic,
        context,
        pauseForReview,
        pauseForBlueprintReview,
        newsTypeId,
        lengthPresetId,
        overrides,
      },
      (event) => emit({ type: "stage", ...event }),
    );

    if (result.status === "awaiting_review" && result.context.facts) {
      emit({ type: "awaiting_review", runId: result.runId, facts: result.context.facts });
    } else if (result.status === "awaiting_blueprint_review" && result.context.blueprint) {
      emit({
        type: "awaiting_blueprint_review",
        runId: result.runId,
        blueprint: result.context.blueprint,
      });
    } else if (result.context.article) {
      emit({
        type: "completed",
        runId: result.runId,
        articleId: result.articleId,
        article: result.context.article,
        enrichment: result.context.enrichment,
      });
    }
  });
}
