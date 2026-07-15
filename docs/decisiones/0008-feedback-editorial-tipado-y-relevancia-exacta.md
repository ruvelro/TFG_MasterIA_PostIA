# ADR 0008 — Feedback editorial tipado y relevancia documental exacta

- **Estado:** aceptada
- **Fecha:** 2026-07-15

## Contexto

Las pruebas con artículos reales mostraron dos límites del bucle descrito en el
[ADR 0006](0006-evolucion-pipeline-11-etapas.md):

1. `quality-review` podía elevar el `aiScore` y describir patrones artificiales mientras
   `validate` devolvía cero incidencias. El orquestador rehumanizaba por la puntuación, pero
   `humanize` solo recibía los issues `ai-tone` de `validate` y no sabía qué corregir.
2. La relevancia documental por solapamiento de palabras aceptaba versiones adyacentes. Una
   página sobre Windows 11 25H2 podía entrar en una investigación sobre 26H2 por compartir
   únicamente el término genérico `Windows`.

## Decisión

- Los issues de `quality-review` incorporan una categoría obligatoria y tipada:
  `structure`, `factual-support`, `seo` o `ai-tone`.
- Si `aiScore` alcanza el umbral editorial, el contrato del juez exige al menos un issue
  `ai-tone` concreto y accionable. `humanize` recibe los issues de tono de ambos jueces,
  deduplicados; `fixer` mantiene acceso al informe completo.
- El contexto persistido normaliza los informes históricos sin categoría para que los runs
  anteriores sigan siendo legibles y reanudables.
- `research` detecta identificadores que mezclan letras y cifras, como `26H2`, `USB4` o
  `GPT-5.5`. Al seleccionar una fuente exige que al menos uno se conserve tanto en metadatos
  como en el cuerpo descargado.
- Las consultas expandidas conservan esos identificadores de forma determinista aunque el
  modelo los omita. La cobertura temática del cuerpo participa además en la puntuación y las
  versiones semestrales del año actual activan la ventana automática de frescura.

## Alternativas descartadas

- **Enviar todos los issues de calidad a `humanize`:** mezclaría problemas factuales, SEO y
  estructura con una etapa cuya responsabilidad es exclusivamente estilística.
- **Inferir categorías con expresiones regulares sobre la descripción:** sería frágil ante
  cambios de idioma o redacción del juez. La categoría forma parte del contrato Zod.
- **Confiar solo en el prompt de expansión:** un modelo puede omitir o sustituir el número de
  versión. La preservación se aplica también en código antes de llamar al buscador.
- **Mantener fuentes de versiones próximas como contexto:** permite que hechos obsoletos reciban
  autoridad por pertenecer al mismo fabricante. Pueden recuperarse en otra consulta si el tema
  las necesita explícitamente.

## Consecuencias

- (+) Toda rehumanización gobernada por `aiScore` recibe una explicación corregible.
- (+) Las etapas conservan responsabilidades separadas mediante categorías tipadas.
- (+) Disminuye el riesgo de validar datos de una versión vecina o una página mal enlazada.
- (+) Los runs anteriores siguen siendo compatibles al rehidratar el contexto.
- (−) Los temas con un identificador muy raro pueden devolver menos fuentes; el pipeline falla
  de forma explícita si no encuentra documentación útil en vez de redactar con material ajeno.
