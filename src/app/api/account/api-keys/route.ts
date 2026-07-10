import type { NextRequest } from "next/server";
import { z } from "zod";

import { createApiKeyForUser, listApiKeysForUser } from "@/lib/api-keys/service";
import { requireSession } from "@/lib/auth/authorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createKeySchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la clave").max(80),
});

/** Lista las claves de API del usuario (nunca la clave ni su hash, solo el prefijo). */
export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }
  return Response.json(await listApiKeysForUser(session.user.id));
}

/** Crea una clave nueva. La respuesta incluye la clave EN CLARO una única vez. */
export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  return Response.json(await createApiKeyForUser(session.user.id, parsed.data.name), {
    status: 201,
  });
}
