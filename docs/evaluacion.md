# Harness de evaluación del pipeline

El harness convierte el pipeline en un objeto de **experimentación medible**: ejecuta un
conjunto dorado de temas fijos bajo distintas configuraciones y mide cada caso en tres
ejes — **calidad**, **coste** y **latencia**. Permite responder con datos a la pregunta
central del TFM: _¿aporta el pipeline multi-etapa frente a una sola llamada?_

## Qué se mide

| Eje      | Cómo                                                                                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calidad  | Juez LLM **independiente** con rúbrica fija (fidelidad, estructura, estilo, SEO, global) + métricas deterministas (palabras, párrafos, uniformidad, keyword) + métricas internas del pipeline (`validationPassed`, `groundedness`, `aiScore`). |
| Coste    | `costUsd` por etapa, ya instrumentado por el orquestador (precios de OpenRouter congelados en el momento del run).                                                                                                                             |
| Latencia | Tiempo de pared del caso completo.                                                                                                                                                                                                             |

El juez debe ser un modelo **distinto** de los del pipeline para evitar el sesgo de
auto-preferencia; el CLI avisa si coinciden (`--judge-model` para cambiarlo).

## Configuraciones comparadas

Definidas en `src/lib/eval/configurations.ts`:

- `base` — la configuración real del admin (referencia).
- `economico` — todas las etapas con el modelo barato.
- `sin-humanize` — sin la etapa de humanización.
- `iteraciones-1` / `iteraciones-3` — presupuesto del bucle de calidad.
- `llamada-unica` — **línea base**: misma investigación, una única llamada de redacción.

## Cómo se ejecuta

Requiere la clave de OpenRouter y el buscador configurados en la app (como cualquier
generación). Los runs se persisten a nombre del usuario `eval@postia.local`.

```bash
# Todo el conjunto dorado × todas las configuraciones (puede tardar y costar dinero):
npm run eval

# Acotado: 3 temas, dos configuraciones y juez explícito
npm run eval -- --limit 3 --configs base,llamada-unica --judge-model openai/gpt-4o

# Agregar un fichero de resultados a la tabla Markdown para la memoria
npm run eval:report -- eval-results/eval-<fecha>.jsonl
```

Cada caso emite una línea JSONL (`eval-results/`, fuera del control de versiones) con el
registro completo; `eval:report` agrega por configuración (medias de juez, coste y
latencia, tasa de validación) y produce la tabla de la **frontera coste/calidad**.

## Diseño

- `src/lib/eval/golden-set.ts` — temas fijos (la clave de la comparabilidad).
- `src/lib/eval/configurations.ts` — variantes como transformaciones de la config base.
- `src/lib/eval/judge.ts` — rúbrica (versionada: `rubricVersion` viaja en cada registro).
- `src/lib/eval/metrics.ts` — métricas deterministas, puras y testeadas.
- `src/lib/eval/runner.ts` — ejecuta un caso y lo condensa en un `EvalRecord`.
- `src/lib/eval/report.ts` — agregación (separada del CLI para testear la aritmética).
- `scripts/eval.ts` / `scripts/eval-report.ts` — CLI (`tsx`).

Los casos se ejecutan en **secuencia** a propósito: el paralelismo dispararía los límites
de tasa del proveedor y contaminaría la medición de latencia. Un fallo en un caso se
registra como `status: "error"` y no interrumpe el resto del barrido.
