<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PostIA — Guía para agentes y colaboradores

> Este archivo es la **fuente de verdad** para cualquier agente de IA o persona que
> trabaje en el repo. `CLAUDE.md` simplemente lo referencia. Si cambias convenciones,
> cámbialas aquí.

## 1. Qué es el proyecto

**PostIA** es un generador de artículos de blog mediante IA, desarrollado como Trabajo
de Fin de Máster. Su núcleo es un **pipeline multi-etapa** donde cada etapa puede usar
un modelo distinto a través de **OpenRouter**. El catálogo único y ordenado de etapas vive
en `src/lib/pipeline/stages.ts` (`STAGE_IDS`); son **11**:

1. **research** — busca N fuentes y descarga su contenido (fuente de verdad). No usa IA.
2. **extract** — extrae los hechos clave con su cita (Zod). Revisable por el usuario (pausa opcional).
3. **blueprint** — diseña la estructura: titular, ángulo, secciones, keyword (Zod). Revisable (pausa opcional).
4. **draft** — redacta el artículo con hechos + estructura + voz editorial + reglas SEO/GEO.
5. **humanize** — reescribe el borrador para eliminar patrones de IA (muletillas, estructura repetitiva).
6. **validate** — informe estructurado (fidelidad, tono IA, editorial, SEO/GEO); modelo "juez".
7. **factual-review** — clasifica cada afirmación (confirmada/dudosa/descartada) y emite un riesgo global.
8. **quality-review** — puntúa estructura, soporte factual, SEO y el `aiScore` que gobierna la re-humanización.
9. **fixer** — corrige según los informes, marca negritas y genera la meta SEO final. Bucle de calidad.
10. **scrub** — elimina meta-referencias de investigación del texto final (regex). No usa IA.
11. **enrich** — genera titulares alternativos, tags, FAQ, alt de imagen, Schema.org y prompt de imagen.

Las etapas `humanize`, `factual-review` y `quality-review` son **opcionales** según el tipo de
noticia. El porqué de la evolución 6→11 está en `docs/decisiones/0006-evolucion-pipeline-11-etapas.md`.

El criterio de evaluación del TFG son las **buenas prácticas**, no solo que funcione.

## 2. Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (estricto).
- **Tailwind CSS v4** para estilos.
- **Prisma + SQLite** para persistencia.
- **Better Auth** para autenticación: email + contraseña (política de contraseñas fuertes)
  y **passkeys/WebAuthn** como método adicional opcional. Registro abierto.
- **Vercel AI SDK + OpenRouter** para la capa de IA.
- **Zod v4** para validación de entrada y de salidas estructuradas de IA.
- **Vitest** (unit/integration) + **Playwright** (e2e).

## 3. Estructura

```
src/
  app/            Rutas (App Router): páginas, layouts y route handlers (api/)
  components/     Componentes de UI pequeños y reutilizables
  lib/
    config/       Validación de entorno (env.ts) y constantes
    crypto/       Cifrado de secretos en reposo (AES-256-GCM)
    http/         Utilidades HTTP (streaming NDJSON, rate limiting)
    db/           Cliente Prisma
    auth/         Better Auth: instancia servidor, cliente, sesión, autorización (roles)
    articles/     Repositorio de artículos (consultas filtradas por usuario)
    settings/     Repositorios de configuración (secretos cifrados, ajustes, config por paso)
    ai/           Cliente OpenRouter + resolución de modelo/prompt por etapa
    search/       Abstracción de proveedores de búsqueda (Tavily, Google CSE)
    pipeline/     Orquestador + etapas (steps/) + tipos + prompts por defecto + plantillas
    validation/   Esquemas Zod compartidos
  types/          Tipos compartidos
tests/            unit / integration / e2e
docs/             Documentación detallada (ver docs/README no aplica; ver índice)
prisma/           schema.prisma, migraciones y seed
```

## 4. Convenciones de código (obligatorias)

- **Idioma:** documentación en **español**; identificadores y código en **inglés**.
  Los comentarios se escriben en español.
- **Comentarios inteligentes:** explican el _porqué_ de una decisión o un trade-off,
  no parafrasean lo que el código ya dice.
- **Archivos pequeños y centrados:** una responsabilidad por archivo. Si un archivo
  crece demasiado, divídelo. Cada etapa del pipeline vive en su propio archivo.
- **Seguridad por diseño y por defecto:** validar toda entrada con Zod; secretos solo
  en el servidor (nunca `NEXT_PUBLIC_*`); verificar autenticación/autorización en cada
  Server Action y Route Handler; nunca confiar en la protección del `proxy` como única
  capa.
- **Tipado fuerte:** TypeScript estricto, sin `any`. Los contratos se comparten vía
  `src/types` y esquemas Zod.
- **0 deuda técnica** salvo que se indique explícitamente. Nada de TODOs sin ticket.

## 5. Comandos

| Comando                 | Qué hace                               |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                 |
| `npm run build`         | Build de producción                    |
| `npm run lint`          | ESLint                                 |
| `npm run typecheck`     | Comprobación de tipos (`tsc --noEmit`) |
| `npm run format`        | Formatea con Prettier                  |
| `npm run test`          | Tests unit/integration (Vitest)        |
| `npm run test:coverage` | Tests con cobertura                    |
| `npm run test:e2e`      | Tests end-to-end (Playwright)          |

Antes de abrir un PR: `npm run lint && npm run typecheck && npm run test` en verde.

## 6. Flujo de trabajo Git

- Ramas: `main` (estable) ← `develop` (integración) ← `feature/*` | `fix/*` | `chore/*` | `docs/*`.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Cada feature se integra en `develop` mediante **Pull Request**; las releases van de
  `develop` a `main` por PR.
- Hooks: `pre-commit` corre lint-staged; `pre-push` corre typecheck + tests.

## 7. Notas de Next.js 16

- El antiguo `middleware.ts` ahora se llama **`proxy.ts`** (misma funcionalidad). Úsalo
  solo para chequeos optimistas de auth, no como única capa de autorización.
- Los Route Handlers usan las APIs Web `Request`/`Response`. Tipar `context` con
  `RouteContext<'/ruta/[param]'>` y recordar que `params` es asíncrono (`await`).
- Verificar siempre la sesión dentro de cada Server Action / Route Handler.
