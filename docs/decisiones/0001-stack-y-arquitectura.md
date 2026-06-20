# ADR 0001 — Stack y arquitectura base

- **Estado:** aceptada
- **Fecha:** 2026-06-20

## Contexto

PostIA es un TFG cuyo criterio de evaluación son las buenas prácticas. Necesitamos un
stack que permita demostrar clean code, seguridad, tests y un flujo de Git profesional,
y que a la vez sea sencillo de ejecutar y defender en local, sin infraestructura pesada.

El núcleo funcional es un pipeline de IA multi-etapa con modelo configurable por etapa,
servido a través de OpenRouter, más una capa de research basada en APIs de búsqueda.

## Decisión

- **Next.js 16 full-stack** (App Router) como aplicación monolítica: una sola base de
  código para UI y backend, un solo despliegue.
- **Dominio en `src/lib`** independiente de React/Next, para poder testearlo de forma
  aislada y mantener los componentes finos.
- **Prisma + SQLite** por cero infraestructura y migrabilidad a PostgreSQL.
- **Auth.js (Credentials) + bcrypt** en lugar de auth propia, por seguridad y simplicidad.
- **Vercel AI SDK + OpenRouter** para habilitar el modelo por etapa con una sola clave.
- **Interfaces de variación** para modelo (por etapa) y proveedor de búsqueda, evitando
  condicionales dispersos.

## Alternativas descartadas

- **Backend separado (FastAPI/Express) + SPA:** más piezas que desplegar y mantener; no
  aporta valor en el alcance del TFG.
- **PostgreSQL desde el inicio:** requiere Docker para ejecutar; SQLite cubre el caso y es
  migrable.
- **Auth propia con JWT a mano:** más superficie de error de seguridad sin beneficio claro.

## Consecuencias

- (+) Ejecución local trivial; lógica de dominio muy testeable.
- (+) Cambiar modelo o proveedor de búsqueda es configuración, no código.
- (−) SQLite no es ideal para alta concurrencia; aceptable para el alcance académico.
