# Modelo de datos

> El esquema vive en `prisma/schema.prisma` (se implementa en la Fase 2). Este documento
> describe las entidades y sus relaciones.

## Entidades de autenticación (gestionadas por Better Auth)

- **User** — usuario registrado. La contraseña **no** vive aquí.
- **Account** — credenciales del usuario; almacena el **hash de la contraseña** (scrypt).
- **Session** — sesiones activas (token, expiración, IP/user-agent).
- **Verification** — tokens temporales (p. ej. verificación de email, si se habilita).
- **Passkey** — credenciales WebAuthn registradas por el usuario (clave pública, contador…).

> Los nombres de campo de estas tablas los fija Better Auth y no deben renombrarse.

## Entidades de dominio (PostIA)

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
