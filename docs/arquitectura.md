# Arquitectura

## Visión general

PostIA es una aplicación **full-stack monolítica** sobre Next.js (App Router). El mismo
proyecto sirve la interfaz (React Server/Client Components) y el backend (Route Handlers
y Server Actions). Esta elección reduce la complejidad operativa —un solo despliegue, un
solo lenguaje— sin renunciar a una separación de responsabilidades clara por capas dentro
de `src/lib`.

## Capas

```
┌──────────────────────────────────────────────────────────────┐
│  app/  (UI + rutas)                                           │
│   · Páginas y layouts (React)                                 │
│   · Route Handlers (api/) y Server Actions                    │
└───────────────┬──────────────────────────────────────────────┘
                │ usa
┌───────────────▼──────────────────────────────────────────────┐
│  lib/  (dominio, sin dependencia de React)                    │
│   · pipeline/   orquestador + etapas                          │
│   · ai/         cliente OpenRouter + modelo por etapa         │
│   · search/     proveedores de búsqueda intercambiables       │
│   · auth/       sesión y hashing                              │
│   · db/         cliente Prisma                                │
│   · config/     validación de entorno                         │
│   · validation/ esquemas Zod compartidos                      │
└───────────────┬──────────────────────────────────────────────┘
                │ persiste en
┌───────────────▼──────────────────────────────────────────────┐
│  Prisma + SQLite                                              │
└──────────────────────────────────────────────────────────────┘
```

**Principio clave:** `lib/` no conoce a React ni a Next. Es lógica de dominio testeable
de forma aislada (con Vitest), lo que mantiene los componentes finos y la lógica reutilizable.

## Flujo de una generación

1. El usuario autenticado envía un tema desde la UI.
2. Un Route Handler (`/api/generate`) valida la entrada con Zod y verifica la sesión.
3. El **orquestador** ejecuta las etapas en orden, acumulando un `PipelineContext`.
4. Cada etapa emite un evento de progreso que se transmite a la UI por _streaming_.
5. El artículo final y la traza de la ejecución se guardan en la base de datos.

## Desacoplo por interfaces

Dos puntos de variación se resuelven con interfaces, no con condicionales dispersos:

- **Modelo por etapa** (`lib/ai`): un _resolver_ mapea cada etapa a `{model, temperature,
systemPrompt}`. Cambiar el modelo de una etapa es cambiar configuración, no código.
- **Proveedor de búsqueda** (`lib/search`): la interfaz `SearchProvider` permite alternar
  entre Tavily y Google CSE sin tocar la etapa de research.

Ver detalles en [pipeline.md](pipeline.md) y las decisiones en [decisiones/](decisiones/).
