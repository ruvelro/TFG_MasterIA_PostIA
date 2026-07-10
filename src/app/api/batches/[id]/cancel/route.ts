import { requireSession } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancela un lote del usuario. El worker relee el estado entre item e item, así que la
 * generación en curso termina (su coste ya está comprometido) y las pendientes se saltan.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/batches/[id]/cancel">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!batch || batch.userId !== session.user.id) {
    return new Response("Lote no encontrado", { status: 404 });
  }
  if (batch.status === "completed" || batch.status === "cancelled") {
    return new Response("El lote ya terminó", { status: 409 });
  }

  await prisma.batch.update({ where: { id }, data: { status: "cancelled" } });
  return Response.json({ ok: true });
}
