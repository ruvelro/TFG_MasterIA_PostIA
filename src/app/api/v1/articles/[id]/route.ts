import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/service";
import { getArticleForUser } from "@/lib/articles/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API pública: recupera un artículo por id (JSON). La propiedad se resuelve a través del
 * usuario dueño de la clave: un artículo ajeno se responde como inexistente.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/v1/articles/[id]">,
): Promise<Response> {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return new Response("Clave de API ausente, inválida o revocada", { status: 401 });
  }

  const { id } = await ctx.params;
  const article = await getArticleForUser(id, auth.userId);
  if (!article) {
    return new Response("Artículo no encontrado", { status: 404 });
  }

  return Response.json({
    id: article.id,
    title: article.title,
    slug: article.slug,
    contentMarkdown: article.contentMarkdown,
    metaDescription: article.metaDescription,
    keywords: JSON.parse(article.keywords) as string[],
    metadata: article.metadataJson ? (JSON.parse(article.metadataJson) as unknown) : null,
    createdAt: article.createdAt,
  });
}
