# Pipeline de generación

El corazón de PostIA. Convierte un tema en un artículo mediante etapas encadenadas, cada
una con una responsabilidad única y un contrato de entrada/salida tipado.

## Contrato común

Cada etapa implementa la interfaz `PipelineStep` y recibe/actualiza un `PipelineContext`
compartido. El orquestador las ejecuta en orden y emite el progreso.

> Definición de tipos: `src/lib/pipeline/types.ts` (Fase 4).

## Etapas

| #   | Etapa              | ¿Usa IA?              | Entrada            | Salida                                   |
| --- | ------------------ | --------------------- | ------------------ | ---------------------------------------- |
| 1   | **Research**       | No (APIs de búsqueda) | tema               | lista de fuentes (título, url, extracto) |
| 2   | **Outline**        | Sí                    | tema + fuentes     | esquema estructurado (Zod)               |
| 3   | **Draft**          | Sí                    | outline + fuentes  | borrador en Markdown                     |
| 4   | **Validate**       | Sí (modelo "juez")    | borrador + fuentes | informe de calidad + correcciones        |
| 5   | **Humanize + SEO** | Sí                    | borrador validado  | artículo final + metadatos SEO           |

## Modelo y prompt por etapa

Cada etapa que usa IA (outline, draft, validate, humanize-seo) tiene **modelo** y **prompt**
configurables. La precedencia la resuelve `resolveStepConfig` en `lib/ai/resolve-step.ts`:

```
override puntual (por generación)  >  configuración guardada (admin)  >  valores por defecto
```

- Los **valores por defecto** (modelo + plantilla de prompt) están en
  `lib/pipeline/default-config.ts`.
- El **administrador** puede cambiar modelo y prompt de cada etapa desde el panel `/admin`;
  se guardan en la tabla `PipelineStepConfig`.
- Cada **generación** puede hacer un override puntual de modelo/prompt.

Los prompts son **plantillas** con marcadores que el pipeline rellena con el contexto
acumulado (`lib/pipeline/render-template.ts`): `{{topic}}`, `{{sources}}`, `{{outline}}`,
`{{draft}}`. El modelo concreto de OpenRouter se introduce como texto libre, p. ej.
`google/gemini-2.5-flash`.

## Claves y proveedor de búsqueda

La clave de OpenRouter y las del buscador se guardan **cifradas** en la BD y se gestionan en
`/admin` (ver [seguridad.md](seguridad.md)). El proveedor de búsqueda (Tavily o Google CSE)
también se elige ahí; el research lo consume a través de la interfaz `SearchProvider`.

## Progreso en tiempo real

El orquestador emite un evento por etapa (`pending → running → done | error`) que el
endpoint transmite por streaming a la UI, de modo que el usuario ve el avance sin esperar
al final.

> Esta página se ampliará con los prompts y los esquemas concretos al implementar la Fase 4.
