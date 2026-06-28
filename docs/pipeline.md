# Pipeline de generación

El corazón de PostIA. Convierte un tema en un artículo mediante etapas encadenadas, cada
una con una responsabilidad única y un contrato de entrada/salida tipado. El motor está en
`src/lib/pipeline`; cada etapa vive en `src/lib/pipeline/steps/`.

## Flujo

El pipeline creció de 6 a **11 etapas** para reforzar la lucha anti-IA (humanización),
desdoblar la validación en varios jueces especializados y añadir limpieza y enriquecimiento
GEO. El catálogo único y ordenado de etapas vive en `src/lib/pipeline/stages.ts` (`STAGE_IDS`),
del que beben tanto la UI como el orquestador. El porqué de la evolución está en el
[ADR 0006](decisiones/0006-evolucion-pipeline-11-etapas.md).

```
research → extract → [revisión humana opcional]
        → blueprint → [revisión humana opcional]
        → draft → humanize
        → ( validate + factual-review + quality-review  ⟲  humanize / fixer )
        → scrub → enrich → Article
```

| #   | Etapa              | ¿IA?          | Entrada                                              | Salida                                                                      |
| --- | ------------------ | ------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | **research**       | No (búsqueda) | tema                                                 | N fuentes con su **contenido descargado** (fuente de verdad)                |
| 2   | **extract**        | Sí            | tema + fuentes                                       | hechos con cita `{claim, source}` (Zod) — **revisable por el usuario**      |
| 3   | **blueprint**      | Sí            | tema + hechos                                        | estructura: titular, ángulo, secciones, keyword (Zod) — **revisable**       |
| 4   | **draft**          | Sí            | hechos + estructura + voz editorial + reglas SEO/GEO | borrador en Markdown                                                        |
| 5   | **humanize**       | Sí            | borrador                                             | borrador reescrito sin muletillas ni estructura repetitiva de IA            |
| 6   | **validate**       | Sí (juez)     | borrador + hechos + fuentes                          | informe `{passed, issues[]}` (faithfulness / ai-tone / editorial / seo)     |
| 7   | **factual-review** | Sí (juez)     | borrador + hechos                                    | clasificación por afirmación (confirmada/dudosa/descartada) + riesgo global |
| 8   | **quality-review** | Sí (juez)     | borrador                                             | puntuaciones de estructura, soporte factual, SEO y **aiScore** (sabor a IA) |
| 9   | **fixer**          | Sí            | borrador + informes                                  | artículo corregido + **meta SEO** (title, slug, metaDescription, keywords)  |
| 10  | **scrub**          | No (regex)    | artículo                                             | artículo sin meta-referencias de investigación                              |
| 11  | **enrich**         | Sí            | artículo + métricas                                  | titulares alternativos, tags, FAQ, alt de imagen, Schema.org, prompt imagen |

Además, dentro del bucle corre un **validador editorial determinista** (sin IA,
`steps/editorial-validator.ts`) que comprueba reglas mecánicas (palabras prohibidas,
densidad, citas…) y **fusiona** sus hallazgos en el informe de `validate`; los de severidad
alta marcan el informe como NO superado.

## Etapas opcionales (tipo de noticia)

Cada **tipo de noticia** puede activar o desactivar etapas mediante toggles
(`enableHumanize`, `enableFactualReview`, `enableQualityReview`). Si no hay tipo, se ejecutan
todas (comportamiento por defecto, retrocompatible). `research` nunca es opcional (es la fuente
de verdad). El **preset de longitud** ajusta el número de palabras objetivo del `draft`.

## Revisión humana (pausa / reanudación)

El orquestador puede **pausar** en dos puntos, guardando el estado en
`GenerationRun.contextJson`:

- Tras **extract** (`status = awaiting_review`): el usuario revisa/edita los **hechos**.
- Tras **blueprint** (`status = awaiting_blueprint_review`): el usuario revisa/edita la
  **estructura**.

En ambos casos la generación se **reanuda** (`resumeGeneration`) aplicando lo editado. Si las
revisiones están desactivadas, el pipeline corre de principio a fin.

## Bucle de calidad

Tras la primera humanización, el orquestador entra en un bucle de hasta `maxFixIterations`
pasadas: ejecuta los jueces (`validate` + validador determinista, y según el tipo
`factual-review` y `quality-review`) y, en función de sus resultados, **re-humaniza** (si el
`aiScore` supera `aiScoreThreshold`, hasta `maxHumanizeRetries`) y/o corrige con **fixer**.

El `fixer` produce el artículo final con su meta SEO, por lo que **siempre se ejecuta al menos
una vez** (si la validación pasa a la primera, se ejecuta sin correcciones pendientes). Cerrado
el bucle, `scrub` limpia el texto y `enrich` añade los campos creativos y las métricas
derivadas antes de persistir el `Article`.

## Revisión dirigida (Revision Mode)

`reviseGeneration` regenera un artículo existente a partir de unas **instrucciones**, sin volver
a investigar: reutiliza hechos, estructura y fuentes del run original y toma el artículo previo
como borrador de partida, reentrando directamente en el bucle de calidad.

## Modelo y prompt por etapa

Cada etapa de IA tiene **modelo** y **prompt** configurables. La precedencia la resuelve
`resolveStepConfig` (`src/lib/ai/resolve-step.ts`):

```
override puntual (por generación)  >  configuración guardada (admin)  >  valores por defecto
```

- Defaults en `src/lib/pipeline/default-config.ts`; el admin los edita en `/admin`.
- Prompts como **plantillas** (`src/lib/pipeline/render-template.ts`) con variables que el
  pipeline rellena: `{{topic}} {{sources}} {{facts}} {{blueprint}} {{draft}} {{report}}
{{editorialVoice}} {{seoRules}}`.
- El modelo se introduce como texto libre, p. ej. `google/gemini-2.5-flash`.

## Arquitectura y testabilidad

- `orchestrator.ts` recibe las **dependencias inyectadas** (`PipelineDeps`: IA y búsqueda)
  y la configuración resuelta (`ResolvedPipelineConfig`); `build-deps.ts` arma las reales
  (claves descifradas + proveedor activo) y `service.ts` es la fachada que usará el endpoint.
- Esta inyección permite testear el orquestador con dobles deterministas, sin red ni claves.
- Cada etapa registra una fila `GenerationStep` (modelo, tokens, duración, intento) para
  trazabilidad, y el orquestador emite `StageEvent` (consumibles por SSE en la UI).

## Claves y proveedor de búsqueda

La clave de OpenRouter y las del buscador se guardan **cifradas** en la BD y se gestionan en
`/admin` (ver [seguridad.md](seguridad.md)). El proveedor de búsqueda (Tavily o Google CSE)
también se elige ahí; el research lo consume a través de la interfaz `SearchProvider`.
