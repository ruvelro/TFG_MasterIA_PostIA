import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (antes "middleware") de Next.js 16.
 *
 * Hace solo una comprobación OPTIMISTA: si el usuario intenta entrar en una ruta protegida
 * sin cookie de sesión, lo redirige a /login antes de renderizar. Esto mejora la UX
 * (redirección instantánea), pero NO es la barrera de seguridad real: la verificación
 * fiable de la sesión se hace en el layout del grupo (app) con `getCurrentSession()`.
 * Defensa en profundidad: nunca confiamos solo en esta capa.
 */
const PROTECTED_PREFIXES = ["/generate", "/articles", "/account", "/admin"];

// Better Auth nombra la cookie de sesión distinto según el esquema: `__Secure-` sobre HTTPS.
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  // Guardamos el destino para volver a él tras iniciar sesión.
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/generate/:path*", "/articles/:path*", "/account/:path*", "/admin/:path*"],
};
