# ADR 0006 — Evolución del pipeline a 12 etapas

- **Estado:** aceptada (supersede al [ADR 0004](0004-pipeline-seis-etapas.md), que queda como
  registro histórico del diseño de 6 etapas)
- **Fecha:** 2026-06-28

## Contexto

El [ADR 0004](0004-pipeline-seis-etapas.md) fijó un pipeline de 6 etapas
(`research → extract → blueprint → draft → validate ⟲ fixer`). Al usar el sistema con casos
reales aparecieron tres carencias que el TFM debía abordar para sostener su criterio de
calidad:

1. **Sabor a IA.** El borrador de `draft` arrastraba muletillas, estructura repetitiva y voz
   genérica que el bucle `validate ⟲ fixer` no eliminaba de forma fiable: corregir hechos y
   SEO no es lo mismo que reescribir para que suene humano.
2. **Validación monolítica.** Un único juez `validate` mezclaba fidelidad a las fuentes, tono,
   reglas editoriales y SEO. Juntar criterios tan distintos en una sola llamada daba informes
   menos accionables y difíciles de puntuar.
3. **Salida sin pulir ni enriquecer.** El artículo final conservaba meta-referencias de
   investigación y no aprovechaba la oportunidad GEO (FAQ, Schema.org, titulares alternativos,
   etc.), cada vez más relevante para los motores generativos.
4. **Imagen destacada fuera del flujo.** El sistema generaba un prompt de imagen, pero no podía
   producir ni persistir la imagen destacada como parte gobernada del pipeline.

## Decisión

Ampliar el pipeline a **12 etapas**, manteniendo el diseño con inyección de dependencias y la
trazabilidad por `GenerationStep`. El catálogo único y ordenado vive en
`src/lib/pipeline/stages.ts` (`STAGE_IDS`), del que beben UI y orquestador.

```
research → extract → blueprint → draft → humanize
→ ( validate + factual-review + quality-review  ⟲  humanize / fixer )
→ scrub → enrich → feature-image → Article
```

Etapas añadidas respecto al ADR 0004:

- **humanize**: reescribe el borrador para eliminar patrones de IA. Se ejecuta una vez tras el
  `draft` y puede **repetirse** dentro del bucle si el `aiScore` supera un umbral
  (`aiScoreThreshold`) o `validate` mantiene una incidencia `ai-tone` media/alta, hasta
  `maxHumanizeRetries`.
- **factual-review**: juez especializado que clasifica cada afirmación del artículo
  (confirmada / dudosa / descartada) frente a los hechos y emite un riesgo global.
- **quality-review**: juez que puntúa estructura, soporte factual, SEO y, sobre todo, el
  **aiScore** que gobierna la re-humanización.
- **scrub**: limpieza determinista (regex, sin IA) que elimina meta-referencias de
  investigación del texto final.
- **enrich**: genera los campos creativos y GEO (titulares alternativos, tags, FAQ, alt de
  imagen, Schema.org, prompt de imagen) y consolida las métricas derivadas.
- **feature-image**: genera y persiste la imagen destacada a partir del prompt de `enrich`.
  Es opcional: si falla o está desactivada, el artículo se entrega sin imagen.

Decisiones de diseño que acompañan a la ampliación:

- **Etapas opcionales por tipo de noticia.** `humanize`, `factual-review`, `quality-review` y
  `feature-image` se activan/desactivan con toggles del tipo (`enableHumanize`,
  `enableFactualReview`, `enableQualityReview`, `enableFeatureImage`). Sin tipo, se ejecutan
  las fases de calidad y la imagen queda desactivada por defecto. `research` nunca es opcional.
- **Segunda pausa de revisión humana** tras `blueprint`
  (`status = awaiting_blueprint_review`), análoga a la de `extract`.
- **Validador editorial determinista** (sin IA) cuyos hallazgos se fusionan en el informe de
  `validate`: las reglas mecánicas no deben gastar tokens ni depender del juicio del modelo.
- **Corrección factual accionable.** `fixer` recibe primero y de forma obligatoria solo las
  afirmaciones `doubtful` o `discarded`; las confirmadas no ocultan los cambios pendientes.
- **Humanización dirigida y reversible.** Cada reintento recibe las incidencias `ai-tone` del
  último informe. El texto se vuelve a medir y, si aumenta el `aiScore`, se restaura el borrador
  anterior para impedir una regresión editorial.
- **Selección documental posterior a la descarga.** `research` reúne un pool mayor que el número
  final de fuentes, descarga los candidatos y después descarta redes sociales y snippets mínimos,
  exige relevancia entre tema y metadatos, elimina cuerpos duplicados conservando la fuente más
  autorizada, prioriza actualidad y limita referencias comunitarias cuando hay alternativas.
- **Cronología explícita para el juez.** `quality-review` recibe la fecha de ejecución para no
  confundir hechos recientes posteriores al corte de conocimiento del modelo con simulaciones.

## Alternativas descartadas

- **Mantener un único juez `validate`:** informes menos accionables; imposible puntuar el
  sabor a IA de forma independiente para gobernar la re-humanización.
- **Humanizar solo dentro de `fixer`:** mezcla dos responsabilidades (corregir vs. reescribir
  para sonar humano) y dificulta medir el progreso entre iteraciones.
- **Enriquecer en el `draft`:** la FAQ, el Schema.org y los titulares alternativos salen mejor
  del artículo ya terminado que de un esqueleto.
- **Generar la imagen fuera del pipeline:** habría menos trazabilidad y el artículo no podría
  conservar el vínculo entre prompt, modelo y artefacto generado.

## Consecuencias

- (+) Mejor control anti-IA (humanize gobernada por `aiScore`) y validación accionable por
  jueces especializados.
- (+) Artículo final limpio y enriquecido para SEO/GEO sin pasos manuales.
- (+) Imagen destacada opcional trazada dentro del mismo ciclo de generación.
- (+) Configurable por tipo de noticia: cada caso paga solo las etapas que necesita.
- (−) Más etapas = más latencia y coste por generación (acotados por los toggles, `N` y
  `maxFixIterations` / `maxHumanizeRetries`). La trazabilidad de coste por etapa
  (`GenerationStep`) hace ese coste visible.
- (−) Más superficie de configuración (modelo + prompt por etapa), mitigada por
  `resolveStepConfig` y los valores por defecto.
