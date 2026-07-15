# ADR 0012 — Reconciliación temporal y alcance factual

- **Estado:** aceptada
- **Fecha:** 2026-07-15

## Contexto

Una pieza puede disponer de fuentes correctas y aun así combinar estados incompatibles. Ocurre
cuando una vista previa y un lanzamiento general se tratan como hechos simultáneos, o cuando una
fuente antigua describe como vigente una disponibilidad que otra posterior ya modificó.

También se observaron dos extrapolaciones que los contratos anteriores no rechazaban siempre:

- porcentajes de mejora sin indicar la referencia, versión, periodo o configuración;
- recomendaciones generales deducidas de un único benchmark de alcance limitado.

En paralelo, `quality-review` podía penalizar párrafos uniformes y fórmulas repetidas, pero aceptar
una sucesión de secciones formalmente distintas que cumplían exactamente la misma función para
cada producto. El resultado seguía pareciendo una comparación generada a partir de fichas.

## Decisión

- `factual-review` recibe la fecha actual y debe reconstruir el estado temporal. Una fuente posterior
  prevalece para describir el presente; los estados anteriores solo se conservan como antecedentes
  fechados. Las discrepancias vigentes se clasifican como dudosas.
- Una cifra comparativa sin referente explícito queda sin respaldo. El juez no puede completar por
  su cuenta la base omitida por el artículo.
- El alcance de una evaluación se limita al ámbito y configuración que mide. Una conclusión general
  obtenida de una única prueba se considera inferencia y no hecho confirmado.
- `quality-review` penaliza como tono de IA tres o más secciones consecutivas con la misma función y
  orden interno, aunque varíen las palabras o longitudes.
- `humanize` y `fixer` pueden reorganizar la pieza por decisiones o consecuencias, y deben rebajar
  titulares absolutos que prometan infalibilidad o descarten una opción de forma universal.

## Alternativas descartadas

- **Confiar solo en la frescura de `research`:** una búsqueda reciente puede devolver tanto el
  anuncio inicial como una actualización posterior; seleccionar fuentes no resuelve por sí mismo
  cuál describe el estado vigente.
- **Eliminar todas las recomendaciones editoriales:** impediría artículos de análisis legítimos. La
  revisión debe limitar su alcance y evidencia, no reducir la pieza a una lista de hechos.
- **Detectar simetría únicamente con expresiones regulares:** la repetición relevante es funcional,
  no necesariamente léxica; dos encabezados distintos pueden introducir fichas idénticas.
- **Añadir campos al esquema factual:** el contrato actual ya permite clasificar estas incidencias
  como inferidas, sin soporte o contradictorias, evitando una migración innecesaria.

## Consecuencias

- (+) Las noticias sujetas a cambios dejan de mezclar condiciones históricas con disponibilidad
  vigente.
- (+) Las cifras comparativas y recomendaciones quedan mejor delimitadas por su evidencia real.
- (+) La corrección de estilo actúa sobre la arquitectura completa y no solo sobre frases aisladas.
- (+) Los tests de contrato protegen estas reglas en los prompts predeterminados.
- (−) El juez factual debe razonar sobre cronología y alcance, por lo que conviene mantener para esta
  etapa un modelo con capacidad suficiente de comparación y seguimiento de instrucciones.
