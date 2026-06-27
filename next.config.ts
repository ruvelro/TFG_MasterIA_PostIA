import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a todas las rutas (seguridad por defecto).
 *
 * Se documenta el porqué de cada una porque son una de las defensas más baratas y
 * efectivas frente a clickjacking, sniffing de tipo MIME y fuga de información por
 * el header Referer. La CSP es deliberadamente conservadora: permite estilos y
 * scripts inline porque Next.js/Tailwind los necesitan para hidratar, pero restringe
 * el resto de orígenes a `self`. Las llamadas a OpenRouter y a las APIs de búsqueda
 * se hacen siempre desde el servidor, por lo que `connect-src 'self'` es suficiente.
 *
 * `'unsafe-eval'` se añade SOLO en desarrollo: Turbopack/React lo usan para el HMR y la
 * depuración. En producción React nunca usa eval, así que la CSP se mantiene estricta.
 */
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  // Evita que el navegador "adivine" el tipo MIME y ejecute como script algo que no lo es.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking: la app no puede embeberse en un iframe de otro origen.
  { key: "X-Frame-Options", value: "DENY" },
  // No filtra la URL completa como Referer hacia orígenes externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles del navegador que la app no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Fuerza HTTPS durante 2 años una vez servido por TLS (inocuo en http local).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // `poweredByHeader: false` elimina el header `X-Powered-By`, que revela el framework.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
