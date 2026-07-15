import { buildArticlePreview } from "@/lib/articles/preview";
import { getArticlePreviewForUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

/** Devuelve los datos del visor solo al propietario autenticado del artículo. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/articles/[id]/preview">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const article = await getArticlePreviewForUser(id, session.user.id);
  if (!article) return new Response("Artículo no encontrado", { status: 404 });

  return Response.json(buildArticlePreview(article), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
