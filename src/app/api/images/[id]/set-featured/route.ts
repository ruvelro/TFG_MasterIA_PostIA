import { z } from "zod";

import { setArticleFeaturedImage } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";
import { getImageForUser } from "@/lib/images/repository";
import { readGeneratedImage } from "@/lib/images/storage";
import { logError } from "@/lib/observability/error-log";
import { storeFeaturedImageBuffer } from "@/lib/publish/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ articleId: z.string().min(1) });

/**
 * Asigna una imagen de la galería como imagen destacada de un artículo del usuario (feature 4).
 * Verifica la propiedad de AMBOS recursos, copia el binario a la carpeta de destacadas con el
 * id del artículo como nombre (así el route handler de la destacada lo sirve sin cambios) y
 * actualiza `featuredImagePath`. Copiar (no referenciar) desacopla ambos: borrar la imagen de la
 * galería no deja al artículo sin destacada.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/images/[id]/set-featured">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const image = await getImageForUser(id, session.user.id);
  if (!image) return Response.json({ error: "Imagen no encontrada." }, { status: 404 });

  try {
    const { data, mediaType } = await readGeneratedImage(image.path);
    const featuredPath = await storeFeaturedImageBuffer({
      basename: parsed.data.articleId,
      data,
      mediaType,
    });
    const updated = await setArticleFeaturedImage(
      parsed.data.articleId,
      session.user.id,
      featuredPath,
    );
    if (!updated) return Response.json({ error: "Artículo no encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error asignando la imagen";
    await logError({
      category: "server",
      message: "Fallo al asignar imagen destacada desde la galería",
      detail: `imagen=${id} · artículo=${parsed.data.articleId} · ${message}`,
      userId: session.user.id,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
