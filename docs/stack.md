# Stack tecnológico y justificación

Cada elección prioriza **buenas prácticas demostrables** y **simplicidad operativa** para
poder defender el TFG en local sin infraestructura adicional.

| Tecnología                           | Por qué                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js 16 + React 19**            | Un único proyecto para UI y backend; Server Actions y Route Handlers reducen el _boilerplate_ de API. App Router con componentes de servidor por defecto.             |
| **TypeScript estricto**              | Contratos verificables en compilación; menos errores en runtime.                                                                                                      |
| **Tailwind CSS v4**                  | Estilos co-localizados, sin CSS muerto; configuración mínima.                                                                                                         |
| **Prisma 7 + SQLite**                | ORM tipado con migraciones; SQLite es un fichero, cero infraestructura. Migrable a PostgreSQL cambiando solo el `datasource`. Usa el driver adapter `better-sqlite3`. |
| **Better Auth + scrypt**             | Solución moderna y auditada para sesiones; el hash de contraseña (scrypt) y las passkeys (WebAuthn) los gestiona la librería. Evita reinventar criptografía.          |
| **Vercel AI SDK + OpenRouter**       | Streaming y salidas estructuradas con Zod; OpenRouter da acceso a múltiples proveedores con una sola clave, lo que habilita el "modelo por etapa".                    |
| **Zod v4**                           | Una única fuente de verdad para validar entrada de usuario y salidas de IA.                                                                                           |
| **react-markdown + rehype-sanitize** | Renderiza el Markdown del artículo saneando el HTML resultante, evitando XSS por contenido generado.                                                                  |
| **Vitest + Playwright**              | Vitest comparte config con Vite y es rápido para la lógica de dominio; Playwright cubre el flujo real end-to-end.                                                     |
| **ESLint + Prettier + Husky + CI**   | Estilo y calidad automatizados; los hooks impiden subir código sin formatear o con tipos rotos, y GitHub Actions replica el gate en cada PR.                          |

Ver las alternativas descartadas en [decisiones/](decisiones/).
