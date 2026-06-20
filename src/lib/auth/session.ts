import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Lee la sesión actual en el servidor (Server Components, Server Actions, Route Handlers).
 * Devuelve `{ user, session }` o `null` si no hay sesión válida. Esta es la verificación
 * de seguridad fiable; el `proxy.ts` solo hace una comprobación optimista previa.
 */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}
