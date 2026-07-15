# ADR 0010 — Contratos de contexto y voz editorial

- **Estado:** aceptada
- **Fecha:** 2026-07-15

## Contexto

El contexto adicional se interpolaba en `extract`, `blueprint` y `draft`, pero no volvía a
aparecer en las reescrituras ni en todos los jueces. Una corrección posterior podía eliminar una
instrucción o considerar dudoso un dato aportado por el usuario. Las URLs escritas en ese campo
tampoco entraban directamente en research. La voz editorial llegaba a varias etapas mediante
`{{editorialVoice}}`, pero un prompt personalizado podía omitir el marcador y perderla.

## Decisión

- El contexto se convierte en un contrato transversal: llega a extracción, estructura, redacción,
  humanización, validación, revisión factual, revisión de calidad, corrección, metadata y
  enriquecimiento. La expansión de consultas también lo recibe para orientar la búsqueda.
- La voz global y la específica del tipo se componen y se fuerzan en toda etapa que diseña,
  redacta, reescribe, juzga estilo o genera material editorial.
- Los contratos se anexan en código aunque el prompt editable omita sus marcadores. Los prompts
  de fábrica siguen mostrando las variables para que el comportamiento sea visible en Admin.
- Las URLs HTTP(S) del contexto se descargan como fuentes `userProvided`, se sitúan antes que el
  research descubierto y no consumen su cupo. Continúan sujetas a SSRF y anti-inyección.
- `GenerationSource` persiste `userProvided` y `suspicious`; Revision Mode copia también el
  contexto del run padre.

## Alternativas descartadas

- **Confiar en la propagación implícita por el borrador:** una reescritura o juez puede perder el
  dato sin saber que era obligatorio.
- **Exigir marcadores en el Admin:** rompe configuraciones antiguas y deja el contrato en manos de
  una edición manual accidental.
- **Mezclar las URLs explícitas en el ranking general:** una heurística de relevancia o el límite
  de fuentes podría descartar precisamente la referencia que el usuario pidió priorizar.
- **Desactivar los guards para URLs aportadas:** prioridad factual no equivale a confiar en órdenes
  incrustadas ni permite acceder a redes privadas.

## Consecuencias

- (+) Contexto y voz tienen cobertura demostrable por etapa y sobreviven a pausas y revisiones.
- (+) Las fuentes explícitas se contrastan con research adicional sin competir con él.
- (+) Los prompts personalizados mantienen libertad de edición sin poder omitir los contratos.
- (−) Los prompts de las etapas relevantes crecen ligeramente y consumen algunos tokens más.
- (−) Cada URL explícita añade una descarga, limitada indirectamente por las 4.000 posiciones del
  campo de contexto y por los guards de red existentes.
