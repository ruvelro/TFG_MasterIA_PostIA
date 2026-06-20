# Modelo de datos

> El esquema vive en `prisma/schema.prisma` (se implementa en la Fase 2). Este documento
> describe las entidades y sus relaciones.

## Entidades

- **User** — usuario que inicia sesión y posee sus artículos.
- **Article** — artículo final generado: contenido en Markdown y metadatos SEO.
- **GenerationRun** — una ejecución del pipeline para un tema dado (estado, tema, fechas).
- **GenerationStep** — traza de cada etapa dentro de una ejecución: qué modelo se usó,
  duración y, cuando aplica, tokens. Permite analizar coste y rendimiento por etapa.

## Relaciones (previstas)

```
User 1───∞ Article
User 1───∞ GenerationRun
GenerationRun 1───∞ GenerationStep
GenerationRun 1───0..1 Article   (la ejecución que culmina produce un artículo)
```

Se detallará con los campos exactos al implementar el esquema Prisma.
