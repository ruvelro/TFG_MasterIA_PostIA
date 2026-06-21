# Pipeline de generación

El corazón de PostIA. Convierte un tema en un artículo mediante etapas encadenadas, cada
una con una responsabilidad única y un contrato de entrada/salida tipado. El motor está en
`src/lib/pipeline`; cada etapa vive en `src/lib/pipeline/steps/`.

## Flujo

```
research → extract → [revisión humana opcional] → blueprint → draft → validate ⟲ fixer → Article
```

| #   | Etapa         | ¿IA?          | Entrada                                              | Salida                                                                     |
| --- | ------------- | ------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **research**  | No (búsqueda) | tema                                                 | N fuentes con su **contenido descargado** (fuente de verdad)               |
| 2   | **extract**   | Sí            | tema + fuentes                                       | hechos con cita `{claim, source}` (Zod) — **revisable por el usuario**     |
| 3   | **blueprint** | Sí            | tema + hechos                                        | estructura: titular, ángulo, secciones, keyword (Zod)                      |
| 4   | **draft**     | Sí            | hechos + estructura + voz editorial + reglas SEO/GEO | borrador en Markdown                                                       |
| 5   | **validate**  | Sí (juez)     | borrador + hechos                                    | informe `{passed, issues[]}` (faithfulness / ai-tone / editorial / seo)    |
| 6   | **fixer**     | Sí            | borrador + informe                                   | artículo corregido + **meta SEO** (title, slug, metaDescription, keywords) |

## Revisión humana (pausa / reanudación)

Tras **extract**, el orquestador puede **pausar** (`GenerationRun.status = awaiting_review`),
guardando el estado en `GenerationRun.contextJson`. El usuario revisa/edita los hechos y la
generación se **reanuda** (`resumeGeneration`) aplicando esos hechos. Si la revisión está
desactivada, el pipeline corre de principio a fin.

## Bucle de calidad validate ⟲ fixer

`validate` produce un informe estructurado. Si no pasa, `fixer` corrige según ese informe
(reescribe frases con tono IA, ajusta fidelidad/editorial/SEO, marca negritas) y el resultado
se **vuelve a validar**, hasta `passed` o `maxFixIterations`. El `fixer` también es quien
produce el artículo final con su meta SEO, por lo que siempre se ejecuta al menos una vez.

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
