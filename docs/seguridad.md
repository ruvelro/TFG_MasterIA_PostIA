# Seguridad

La seguridad se trata como un requisito de diseño, no como un añadido. Este documento
resume las amenazas consideradas y los controles aplicados.

## Principios

- **Seguro por defecto:** la configuración por defecto es la segura; relajarla requiere
  una acción explícita y documentada.
- **Defensa en profundidad:** no se confía en una sola capa (p. ej. el `proxy` de Next no
  es la única barrera de autorización; cada Server Action y Route Handler revalida la sesión).
- **Mínima superficie:** los secretos viven solo en el servidor; el cliente nunca los ve.

## Controles por amenaza

| Amenaza                    | Control                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuga de secretos           | Claves solo en variables de entorno de servidor; `.env` en `.gitignore`; nunca `NEXT_PUBLIC_*` para secretos. Validación de entorno _fail-fast_ en `lib/config/env.ts`. |
| Entrada maliciosa          | Validación con Zod en todos los Route Handlers y Server Actions antes de tocar la BD o la IA.                                                                           |
| Acceso no autorizado       | Autenticación con Better Auth; verificación de sesión en cada operación; los artículos se filtran por `userId`.                                                         |
| Credenciales débiles       | Política de contraseñas fuertes (≥12, mayús/minús/número/símbolo + lista de bloqueo), aplicada en cliente Y en un hook de servidor de Better Auth (no se puede saltar). |
| Robo de credenciales       | Contraseñas con hash scrypt (gestionado por Better Auth; nunca en claro). Passkeys/WebAuthn como método sin contraseña resistente a phishing.                           |
| Enumeración de usuarios    | El login devuelve un mensaje genérico que no distingue "email inexistente" de "contraseña incorrecta".                                                                  |
| Clickjacking / sniffing    | Cabeceras de seguridad en `next.config.ts` (CSP, X-Frame-Options, nosniff, etc.).                                                                                       |
| Coste descontrolado de IA  | Límite de peticiones (_rate limit_) en el endpoint de generación.                                                                                                       |
| XSS por contenido generado | El Markdown del artículo se sanea al renderizar; no se inyecta HTML sin sanitizar.                                                                                      |

## Notas

- La cabecera `Strict-Transport-Security` solo surte efecto sobre HTTPS; es inocua en el
  `http://localhost` de desarrollo.
- Este documento se revisa al cerrar las fases de autenticación (Fase 2) y pipeline (Fase 4),
  acompañado de una pasada de `/security-review`.
