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

## Modelo por etapa

Cada etapa declara qué modelo necesita; el _resolver_ de `lib/ai` traduce eso a un modelo
concreto de OpenRouter según configuración. Esto permite, por ejemplo, usar un modelo
económico para el research-outline y uno más capaz para la validación.

## Progreso en tiempo real

El orquestador emite un evento por etapa (`pending → running → done | error`) que el
endpoint transmite por streaming a la UI, de modo que el usuario ve el avance sin esperar
al final.

> Esta página se ampliará con los prompts y los esquemas concretos al implementar la Fase 4.
