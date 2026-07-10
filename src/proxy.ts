import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (antes "middleware") de Next.js 16. Dos responsabilidades:
 *
 * 1. **CSP con nonce por petición.** `script-src` exige un nonce único por respuesta en vez
 *    de `'unsafe-inline'`: un script inline inyectado (XSS) no se ejecuta porque no conoce
 *    el nonce. El nonce viaja en las cabeceras de la petición (`x-nonce` +
 *    `Content-Security-Policy`) para que Next lo aplique a sus scripts de hidratación, y en
 *    la respuesta para que el navegador lo exija. El resto de cabeceras de seguridad
 *    (estáticas) siguen en `next.config.ts`.
 *
 * 2. **Chequeo optimista de sesión.** Si el usuario intenta entrar en una ruta protegida sin
 *    cookie de sesión, se le redirige a /login antes de renderizar. Mejora la UX, pero NO es
 *    la barrera real: la verificación fiable se hace en el layout del grupo (app) con
 *    `getCurrentSession()`. Defensa en profundidad: nunca confiamos solo en esta capa.
 */
const PROTECTED_PREFIXES = ["/generate", "/articles", "/account", "/admin"];

// Better Auth nombra la cookie de sesión distinto según el esquema: `__Secure-` sobre HTTPS.
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP por petición. `'strict-dynamic'` hace que los scripts con nonce puedan cargar sus
 * dependencias (así encadena Next sus chunks); `'self'` queda como respaldo para navegadores
 * sin CSP3. `'unsafe-eval'` solo en desarrollo (HMR de Turbopack); los estilos inline siguen
 * permitidos porque Next/Tailwind los emiten al hidratar y no aceptan nonce.
 */
function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Redirección optimista a /login para rutas protegidas sin cookie de sesión.
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))) {
    const loginUrl = new URL("/login", request.url);
    // Guardamos el destino para volver a él tras iniciar sesión.
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Nonce criptográficamente aleatorio por petición (UUID v4, en base64).
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next lee la CSP de la petición para poner el nonce en sus scripts inline del App Router.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // La CSP debe cubrir TODAS las páginas (no solo las protegidas). Se excluyen los assets
  // estáticos y las imágenes optimizadas (no ejecutan scripts) y las rutas de API (responden
  // JSON/NDJSON). El chequeo de sesión sigue aplicándose por prefijo dentro del proxy.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
