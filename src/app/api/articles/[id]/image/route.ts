import { getArticleForUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";
import { readFeaturedImage } from "@/lib/publish/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sirve la imagen destacada de un artículo. Las imágenes viven fuera de `public/` porque
 * son contenido privado: aquí se verifica sesión y PROPIEDAD antes de leer el fichero.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/articles/[id]/image">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const article = await getArticleForUser(id, session.user.id);
  if (!article?.featuredImagePath) {
    return new Response("Imagen no encontrada", { status: 404 });
  }

  try {
    const { data, mediaType } = await readFeaturedImage(article.featuredImagePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mediaType,
        // La imagen de un artículo no cambia: cacheable en el navegador (privada).
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    // La fila apunta a un fichero que ya no existe (volumen borrado, etc.).
    return new Response("Imagen no disponible", { status: 404 });
  }
}
