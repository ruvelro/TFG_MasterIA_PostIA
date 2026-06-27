# ADR 0005 — Progreso del generador por streaming (NDJSON sobre POST)

- **Estado:** aceptada
- **Fecha:** 2026-06-22

## Contexto

La generación recorre 6 etapas (más el bucle validate↔fixer) y puede tardar bastante. El
usuario debe ver el avance en vivo y, además, hay una **pausa de revisión** intermedia que
requiere enviar datos (tema, overrides, hechos editados) desde el cliente.

## Decisión

Transmitir el progreso como **NDJSON sobre una respuesta POST mantenida abierta**
(`streamJsonEvents` → `ReadableStream`), no con `EventSource`/SSE clásico, porque el disparo
necesita cuerpo (POST). El cliente lee `response.body` y parsea por líneas (`splitNdjson`).

- Dos endpoints: `POST /api/generate` (start, termina en `awaiting_review` o `completed`) y
  `POST /api/generate/[runId]/resume` (reanuda tras la revisión).
- El estado se persiste igualmente en la BD (`GenerationRun`/`GenerationStep`), así que un
  corte del stream no pierde el trabajo (recuperable desde el historial).
- **Seam de test:** con `E2E=true`, `build-deps` inyecta dependencias falsas deterministas,
  lo que permite un e2e real de toda la UI (progreso, revisión, resultado) sin claves.

## Alternativas descartadas

- **Polling** (POST inicia + GET de estado): más robusto ante serverless, pero UX a saltos;
  se documenta como posible mejora si se despliega en serverless.
- **EventSource/SSE GET:** no admite cuerpo en la petición; obligaría a crear el run aparte.

## Consecuencias

- (+) Progreso en vivo y flujo de revisión en la misma conversación cliente↔servidor.
- (+) El Markdown generado se renderiza **saneado** (rehype-sanitize) → defensa XSS.
- (−) Una request larga no encaja bien en plataformas serverless con timeout corto (en local,
  perfecto); migrable a polling o a job en segundo plano si hiciera falta.
