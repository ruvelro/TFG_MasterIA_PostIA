import type { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/client";
import { streamJsonEvents } from "@/lib/http/event-stream";
import { resumeGenerationForRun } from "@/lib/pipeline/service";
import type { GenerationStreamEvent } from "@/lib/pipeline/stream-events";
import { resumeGenerationSchema } from "@/lib/validation/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reanuda una generación pausada en revisión, con los hechos (posiblemente) editados.
 * Verifica sesión y, sobre todo, que el run PERTENECE al usuario antes de continuar.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/generate/[runId]/resume">,
): Promise<Response> {
  const { runId } = await ctx.params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  // Autorización por propietario: no basta con estar autenticado.
  const run = await prisma.generationRun.findUnique({
    where: { id: runId },
    select: { userId: true },
  });
  if (!run || run.userId !== session.user.id) {
    return new Response("Generación no encontrada", { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resumeGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  return streamJsonEvents<GenerationStreamEvent>(async (emit) => {
    const result = await resumeGenerationForRun(
      {
        runId,
        editedFacts: parsed.data.editedFacts,
        editedBlueprint: parsed.data.editedBlueprint,
        overrides: parsed.data.overrides,
      },
      (event) => emit({ type: "stage", ...event }),
    );

    // Al reanudar desde la revisión de hechos con la revisión de estructura activada, el pipeline
    // se vuelve a pausar en el blueprint: hay que avisar al cliente para que muestre su formulario
    // editable. Sin esto, la generación se quedaba colgada en esa segunda pausa.
    if (result.status === "awaiting_blueprint_review" && result.context.blueprint) {
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
