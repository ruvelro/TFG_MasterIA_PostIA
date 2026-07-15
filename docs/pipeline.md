# Pipeline de generación

El corazón de PostIA. Convierte un tema en un artículo mediante etapas encadenadas, cada
una con una responsabilidad única y un contrato de entrada/salida tipado. El motor está en
`src/lib/pipeline`; cada etapa vive en `src/lib/pipeline/steps/`.

## Flujo

El pipeline creció de 6 a **12 etapas** para reforzar la lucha anti-IA (humanización),
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

| #   | Etapa              | ¿IA?          | Entrada                                              | Salida                                                                        |
| --- | ------------------ | ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **research**       | No (búsqueda) | tema                                                 | N fuentes con su **contenido descargado** (fuente de verdad)                  |
| 2   | **extract**        | Sí            | tema + fuentes                                       | hechos con cita `{claim, source}` (Zod) — **revisable por el usuario**        |
| 3   | **blueprint**      | Sí            | tema + hechos                                        | estructura: titular, ángulo, secciones, keyword (Zod) — **revisable**         |
| 4   | **draft**          | Sí            | hechos + estructura + voz editorial + reglas SEO/GEO | borrador en Markdown                                                          |
| 5   | **humanize**       | Sí            | borrador                                             | borrador reescrito sin muletillas ni estructura repetitiva de IA              |
| 6   | **validate**       | Sí (juez)     | borrador + hechos + fuentes                          | informe `{passed, issues[]}` (faithfulness / ai-tone / editorial / seo)       |
| 7   | **factual-review** | Sí (juez)     | borrador + hechos                                    | clasificación por afirmación (confirmada/dudosa/descartada) + riesgo global   |
| 8   | **quality-review** | Sí (juez)     | borrador                                             | puntuaciones de estructura, soporte factual, SEO y **aiScore** (sabor a IA)   |
| 9   | **fixer**          | Sí            | borrador + informes                                  | artículo corregido; al cierre genera la **meta SEO** sin reescribir el cuerpo |
| 10  | **scrub**          | No (regex)    | artículo                                             | artículo sin meta-referencias de investigación                                |
| 11  | **enrich**         | Sí            | artículo + métricas                                  | titulares alternativos, tags, FAQ, alt de imagen, Schema.org, prompt imagen   |
| 12  | **feature-image**  | Sí (imagen)   | prompt de imagen de enrich                           | imagen destacada persistida (opcional; el artículo no depende de ella)        |

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

Tras la primera humanización, el orquestador ejecuta los jueces (`validate` + validador
determinista, y según el tipo `factual-review` y `quality-review`) y aplica **una sola
transformación** antes de volver a medir. La rehumanización y el **fixer** tienen presupuestos
independientes (`maxHumanizeRetries` y `maxFixIterations`), por lo que rehumanizar no consume una
corrección. Cada rehumanización recibe las incidencias `ai-tone` concretas del último informe; si
la nueva medición empeora el `aiScore`, el orquestador restaura el borrador y los informes previos.
Los issues de `quality-review` se clasifican como `structure`, `factual-support`, `seo` o
`ai-tone`: solo estos últimos llegan a `humanize`, mientras el informe completo alimenta al fixer.
Si la puntuación alcanza el umbral, el juez debe emitir al menos un diagnóstico de tono accionable.
El artículo solo se aprueba cuando la validación
editorial pasa, el `aiScore` queda por debajo del umbral, las fuentes se consideran suficientes y
los riesgos factual y de cada dimensión de calidad son `low`; un riesgo `medium` vuelve al
corrector mientras queden iteraciones.

Si se agotan ambos presupuestos sin aprobar, el artículo se conserva para el editor pero el run
termina como `needs_review`, no como `completed`. Cerrado el bucle, una llamada separada
genera únicamente `title`, `slug`, `metaDescription` y `keywords`: el Markdown aprobado se
conserva literalmente. `scrub` limpia el texto y un último validador determinista comprueba el
contenido exacto que se persistirá antes de `enrich`.

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
- En el despliegue Docker, cada arranque vuelve a sincronizar los prompts de fábrica y el
  umbral anti-IA con la base persistente. Conserva los modelos elegidos y el perfil editorial.
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

## Idioma del artículo

El idioma es un parámetro de la generación (campo opcional del formulario y de la API;
por defecto, español). Viaja en el contexto del pipeline y las plantillas lo reciben como
`{{language}}` (redacción y enriquecimiento), de modo que un mismo portal puede producir
piezas en varios idiomas sin tocar la configuración.

## Detalle de la etapa research

La calidad del pipeline está acotada por lo que entra en research, así que la búsqueda se
refuerza en cuatro frentes:

- **Expansión de consultas**: una micro-llamada de IA (modelo barato configurable en
  `/admin`, desactivable) genera 2-3 consultas complementarias al tema literal; los
  resultados se fusionan. Si el modelo falla, se degrada al tema tal cual. No es una etapa
  del catálogo: su coste y tokens se registran en la fila `GenerationStep` de research.
- **Relevancia y deduplicación**: descarta resultados cuyo título, ruta y extracto no guardan
  relación verificable con el tema, bloquea páginas de apuestas ajenas al encargo y elimina
  cuerpos idénticos después de ordenar por autoridad. Además deduplica por URL normalizada y
  limita a 2 fuentes por dominio. Los identificadores alfanuméricos distintivos (`26H2`, `USB4`,
  `GPT-5.5`) deben aparecer en los metadatos y en el cuerpo; también se preservan de forma
  determinista en cada consulta expandida.
- **Frescura**: si el tipo de noticia define `freshnessDays > 0`, el proveedor limita los
  resultados a los últimos N días (Tavily: `topic=news&days=N`; Google: `dateRestrict=dN`).
- **Extracción del cuerpo**: el HTML descargado pasa por `@mozilla/readability` sobre
  `linkedom` (sin navegador), que aísla el artículo y descarta menús, banners y footers;
  si no encuentra un artículo con entidad, se cae al stripping clásico por regex.
