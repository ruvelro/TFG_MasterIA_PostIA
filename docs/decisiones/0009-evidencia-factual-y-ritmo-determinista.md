# ADR 0009 — Evidencia factual y ritmo determinista

- **Estado:** aceptada
- **Fecha:** 2026-07-15

## Contexto

Las auditorías de artículos reales posteriores al
[ADR 0008](0008-feedback-editorial-tipado-y-relevancia-exacta.md) mostraron dos fallos
residuales:

1. Una cifra publicada por una fuente secundaria podía quedar `confirmed` aunque el artículo la
   atribuyera a una fuente primaria que no la había anunciado. El estado factual no distinguía
   respaldo directo, inferencia y contradicción.
2. `quality-review` podía puntuar bien una pieza formada por párrafos casi idénticos. El prompt
   pedía penalizar el ritmo uniforme, pero no aportaba una medición y el juez podía ignorarlo.

## Decisión

- Cada afirmación de `factual-review` incorpora `evidenceType` (`direct`, `inferred`,
  `unsupported`, `contradicted`) y `sourceAuthority` (`primary`, `secondary`, `mixed`,
  `unknown`). El juez recibe además un catálogo compacto con título y URL de las fuentes.
- El postprocesado impone coherencia: una inferencia o afirmación sin respaldo pasa a `doubtful`,
  una contradicción pasa a `discarded` y el riesgo global se eleva en consecuencia. Los informes
  históricos se normalizan al rehidratarse.
- `prose-rhythm.ts` calcula sobre párrafos de prosa el recuento de palabras, coeficiente de
  variación y concentración en una banda dominante. Solo marca uniformidad artificial con al
  menos ocho párrafos y cuando coinciden dos señales conservadoras: dispersión baja y un 75 % de
  párrafos dentro de una banda de 25 palabras.
- `humanize` y `quality-review` reciben el diagnóstico. Si la métrica marca uniformidad,
  el saneamiento de `quality-review` garantiza un issue `ai-tone` y eleva `aiScore` al umbral
  configurado, aunque el juez no lo haya hecho.
- Los prompts identifican también patrones no reducibles a métricas: aperturas con etiquetas
  abstractas, tesis repetidas con sinónimos y cierres que recapitulan la entradilla.

## Alternativas descartadas

- **Confiar únicamente en instrucciones de prompt:** no garantiza que un juez probabilístico
  aplique una regla mecánica ni permite demostrarla con tests deterministas.
- **Usar una varianza aislada:** una pieza corta o varios párrafos casualmente parecidos producirían
  falsos positivos. Se exige volumen mínimo y coincidencia de dos métricas.
- **Descargar de nuevo las fuentes en factual-review:** duplicaría red, latencia y superficie de
  fallo. Los hechos y el catálogo de procedencia ya permiten evaluar la atribución sin otra E/S.
- **Descartar cualquier dato de fuente secundaria:** una fuente periodística puede respaldar hechos
  válidos. Lo que se impide es convertir su inferencia en confirmación del actor original.

## Consecuencias

- (+) Las atribuciones exactas conservan la diferencia entre anuncio oficial e interpretación.
- (+) La rehumanización por cadencia dispone de una señal reproducible y testeable.
- (+) El umbral sigue siendo configurable y los textos breves no se penalizan automáticamente.
- (+) Los runs anteriores continúan siendo reanudables.
- (−) El contrato factual estructurado contiene dos campos adicionales y exige modelos capaces de
  seguir esquemas con precisión.
