import { requireSession } from "@/lib/auth/authorize";
import { revokeApiKey } from "@/lib/api-keys/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoca una clave de API del usuario (las revocadas dejan de autenticar al instante). */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/account/api-keys/[id]">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const revoked = await revokeApiKey(session.user.id, id);
  if (!revoked) {
    return new Response("Clave no encontrada", { status: 404 });
  }
  return Response.json({ ok: true });
}
