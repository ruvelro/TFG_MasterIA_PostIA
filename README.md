# PostIA — Generador de artículos de blog con IA

> Trabajo de Fin de Máster · Curso de desarrollo con IA.
> Aplicación web que genera artículos de blog mediante un **pipeline de IA multi-etapa**,
> donde cada etapa puede usar un modelo distinto a través de [OpenRouter](https://openrouter.ai).

[![CI](https://img.shields.io/badge/CI-pending-lightgrey)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)

---

## a. Descripción general

PostIA convierte un **tema** en un **artículo de blog publicable**. En lugar de una única
llamada a un modelo, orquesta un pipeline de cinco etapas en el que cada paso está
especializado y puede ejecutarse con el modelo más adecuado (más barato para tareas
mecánicas, más potente para validación):

1. **Research** — busca fuentes reales en la web (Tavily / Google CSE). _No usa IA._
2. **Outline** — genera la estructura del artículo como datos validados.
3. **Draft** — redacta el borrador a partir del outline y las fuentes.
4. **Validate** — revisa coherencia y calidad, contrastando con las fuentes.
5. **Humanize + SEO** — pule el tono y produce metadatos SEO (meta description, slug, keywords).

El usuario ve el progreso de cada etapa en vivo y el artículo final se guarda en su historial.

## b. Stack tecnológico

| Capa          | Tecnología                                                 |
| ------------- | ---------------------------------------------------------- |
| Framework     | Next.js 16 (App Router) + React 19                         |
| Lenguaje      | TypeScript (modo estricto)                                 |
| Estilos       | Tailwind CSS v4                                            |
| Persistencia  | Prisma ORM + SQLite                                        |
| Autenticación | Better Auth (email + contraseña, passkeys/WebAuthn)        |
| IA            | Vercel AI SDK + OpenRouter (modelo configurable por etapa) |
| Búsqueda      | Tavily / Google Custom Search (abstracción intercambiable) |
| Validación    | Zod v4                                                     |
| Tests         | Vitest (unit/integration) + Playwright (e2e)               |
| Calidad       | ESLint + Prettier + Husky + lint-staged                    |

## c. Instalación y ejecución

Requisitos: **Node.js 24+** y npm.

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar el entorno
cp .env.example .env
#    Edita .env y añade tus claves (OpenRouter y un proveedor de búsqueda).
#    Genera el secreto de sesión:  openssl rand -base64 32

# 3. Preparar la base de datos (crea el fichero SQLite y aplica las migraciones)
npm run db:migrate

# 4. Arrancar en desarrollo
npm run dev
```

La app queda en `http://localhost:3000`.

## d. Estructura del proyecto

```
src/
  app/         Rutas (App Router): páginas, layouts y API (route handlers)
  components/  Componentes de UI reutilizables
  lib/
    config/    Validación de variables de entorno
    db/        Cliente Prisma
    auth/      Configuración de Better Auth (servidor, cliente, sesión)
    ai/        Cliente OpenRouter + modelo por etapa
    search/    Proveedores de búsqueda (Tavily, Google CSE)
    pipeline/  Orquestador y etapas del pipeline
    validation/ Esquemas Zod compartidos
  types/       Tipos compartidos
tests/         unit / integration / e2e
docs/          Documentación detallada del proyecto
prisma/        Esquema y migraciones
```

Documentación ampliada en [`docs/`](docs/): arquitectura, pipeline, seguridad, modelo de
datos, guía de contribución y decisiones de diseño (ADRs).

## e. Funcionalidades principales

- Generación de artículos mediante pipeline multi-etapa con modelo por etapa.
- Investigación con fuentes reales de la web (no alucinadas).
- Visualización del progreso de cada etapa en tiempo real.
- Registro y autenticación de usuarios (contraseña segura + passkeys opcionales).
- Artículos guardados por usuario.
- Historial de artículos: consultar, releer y eliminar.
- Trazabilidad: cada ejecución registra qué modelo usó cada etapa.

## f. Usuario y contraseña de prueba

Por seguridad, **el proyecto no incluye ningún usuario predefinido**: el primer acceso se
hace **registrándose** en `/register` (registro abierto). Para evaluar la app, crea una
cuenta con cualquier email y una contraseña que cumpla la política:

> Mínimo **12 caracteres**, con **mayúscula, minúscula, número y símbolo** (se rechazan
> además las contraseñas más comunes). Ejemplo válido: `Tfg-PostIA-2026!`

Opcionalmente, desde **Cuenta** puedes registrar una **passkey** (WebAuthn) para iniciar
sesión sin contraseña.

## Scripts

| Comando             | Descripción            |
| ------------------- | ---------------------- |
| `npm run dev`       | Servidor de desarrollo |
| `npm run build`     | Build de producción    |
| `npm run typecheck` | Comprobación de tipos  |
| `npm run lint`      | Linter                 |
| `npm run format`    | Formateo con Prettier  |
| `npm run test`      | Tests unit/integration |
| `npm run test:e2e`  | Tests end-to-end       |

## Licencia

Proyecto académico (TFG). Uso educativo.
