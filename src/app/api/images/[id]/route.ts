import { requireSession } from "@/lib/auth/authorize";
import { deleteImageForUser, getImageForUser } from "@/lib/images/repository";
import { deleteGeneratedImageFile, readGeneratedImage } from "@/lib/images/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sirve una imagen de la galería del usuario. Como las destacadas, viven fuera de `public/`:
 * aquí se verifica sesión y PROPIEDAD antes de leer el fichero.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/images/[id]">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const image = await getImageForUser(id, session.user.id);
  if (!image) return new Response("Imagen no encontrada", { status: 404 });

  try {
    const { data, mediaType } = await readGeneratedImage(image.path);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mediaType,
        // El binario de una imagen no cambia: cacheable en el navegador (privado).
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Imagen no disponible", { status: 404 });
  }
}

/** Borra una imagen de la galería (fila + fichero). Solo su propietario. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/images/[id]">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const path = await deleteImageForUser(id, session.user.id);
  if (path === null) return new Response("Imagen no encontrada", { status: 404 });

  await deleteGeneratedImageFile(path);
  return new Response(null, { status: 204 });
}
