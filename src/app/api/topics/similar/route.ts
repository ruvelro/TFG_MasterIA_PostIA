import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/authorize";
import { findSimilarArticlesForTopic } from "@/lib/embeddings/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const similarTopicSchema = z.object({
  topic: z.string().trim().min(5).max(300),
});

/**
 * Aviso de solape temático ANTES de generar: compara el tema con los artículos previos del
 * usuario (embeddings). Devuelve una lista (posiblemente vacía) de artículos parecidos;
 * si los embeddings no están operativos responde [] — el aviso nunca bloquea el flujo.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = similarTopicSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  const similar = await findSimilarArticlesForTopic(session.user.id, parsed.data.topic);
  return Response.json({ similar });
}
