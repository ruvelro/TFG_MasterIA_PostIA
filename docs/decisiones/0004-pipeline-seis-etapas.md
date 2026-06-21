# ADR 0004 — Pipeline de 6 etapas con revisión humana y bucle de calidad

- **Estado:** aceptada (refina el pipeline de 5 etapas del plan inicial)
- **Fecha:** 2026-06-21

## Contexto

El pipeline inicial tenía 5 etapas (research, outline, draft, validate, humanize-seo). Al
detallar el flujo con el usuario surgieron necesidades más concretas: la investigación debe
**descargar el contenido** de las webs (no solo snippets), separar la **extracción de hechos**
del **diseño de la estructura**, permitir una **revisión humana** de los hechos antes de
redactar, y que el paso final **corrija** lo que detecte la validación en un **bucle**.

## Decisión

Pipeline de **6 etapas**: `research → extract → blueprint → draft → validate ⟲ fixer`.

- **research** descarga el cuerpo de N fuentes (fuente de verdad), con guard anti-SSRF,
  timeout y límite de tamaño.
- **extract** saca hechos con cita; es un **punto de pausa** opcional para que el usuario
  valide/edite antes de continuar (motor con `start` + `resume`, estado en `contextJson`).
- **blueprint** diseña la estructura (titular, secciones, keyword) como artefacto propio.
- La **meta SEO final** se genera al final (en `fixer`), porque sale mejor del artículo ya
  escrito que antes de redactarlo.
- **validate** emite un informe estructurado; **fixer** corrige según ese informe (incluido
  el formato de negritas) y produce el artículo final. Se **reitera** hasta `passed` o
  `maxFixIterations`.

Diseño con **inyección de dependencias**: el orquestador recibe IA/búsqueda como `PipelineDeps`,
lo que lo hace testable sin red ni claves.

## Alternativas descartadas

- **Estructura dentro del draft:** menos control y sin esqueleto revisable.
- **Pasada única validate→fix:** sin garantía de que la corrección resuelva los problemas.
- **Pipeline totalmente automático:** impide la revisión humana de los hechos que pidió el usuario.

## Consecuencias

- (+) Artefactos limpios y revisables; mejor calidad final por el bucle.
- (+) Motor testeable de forma determinista (deps mockeadas) y trazable (`GenerationStep`).
- (−) Más etapas = más latencia y coste por generación (acotados por N y `maxFixIterations`).
- (−) Descargar URLs arbitrarias añade superficie (mitigada con el guard anti-SSRF).
