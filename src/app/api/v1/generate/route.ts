import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/service";
import { indexArticleAndSuggestLinks } from "@/lib/embeddings/service";
import { streamJsonEvents } from "@/lib/http/event-stream";
import { generateRateLimiter } from "@/lib/http/rate-limit";
import { checkDailyBudget } from "@/lib/observability/cost-budget";
import { startGenerationForUser } from "@/lib/pipeline/service";
import type { GenerationStreamEvent } from "@/lib/pipeline/stream-events";
import { startGenerationSchema } from "@/lib/validation/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API pública: inicia una generación autenticada por CLAVE DE API (Authorization: Bearer
 * postia_…) y transmite el progreso con el MISMO streaming NDJSON que la UI. Las pausas de
 * revisión humana se fuerzan a off (la API es desatendida); los límites de tasa y el
 * presupuesto diario aplican igual que en la sesión web, por usuario propietario de la clave.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return new Response("Clave de API ausente, inválida o revocada", { status: 401 });
  }

  if (!generateRateLimiter.check(auth.userId)) {
    return new Response("Demasiadas peticiones, inténtalo en un minuto.", { status: 429 });
  }
  const budget = await checkDailyBudget(auth.userId);
  if (!budget.allowed) {
    return new Response("Presupuesto diario de IA agotado.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  const { topic, context, language, newsTypeId, lengthPresetId, overrides } = parsed.data;

  return streamJsonEvents<GenerationStreamEvent>(async (emit, signal) => {
    const result = await startGenerationForUser(
      {
        userId: auth.userId,
        topic,
        context,
        language,
        // Desatendida: sin pausas de revisión (el consumidor recibe el artículo terminado).
        pauseForReview: false,
        pauseForBlueprintReview: false,
        newsTypeId,
        lengthPresetId,
        overrides,
        signal,
      },
      (event) => emit({ type: "stage", ...event }),
    );

    if (result.context.article) {
      emit({
        type: result.status === "needs_review" ? "needs_review" : "completed",
        runId: result.runId,
        articleId: result.articleId,
        article: result.context.article,
        enrichment: result.context.enrichment,
        hasFeaturedImage: Boolean(result.context.featuredImagePath),
      });
      if (result.articleId) {
        await indexArticleAndSuggestLinks(result.articleId);
      }
    }
  });
}
