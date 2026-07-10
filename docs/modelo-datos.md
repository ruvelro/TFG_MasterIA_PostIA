# Modelo de datos

> El esquema vive en [`prisma/schema.prisma`](../prisma/schema.prisma). Este documento
> describe las entidades y sus relaciones. SQLite no tiene enums ni arrays nativos, así que
> los estados se guardan como `String` y las listas como JSON serializado.

## Entidades de autenticación (gestionadas por Better Auth)

- **User** — usuario registrado. La contraseña **no** vive aquí. Incluye `role`
  (`"user"` | `"admin"`): el primer usuario registrado se promueve a `admin` y puede
  gestionar la configuración global.
- **Account** — credenciales del usuario; almacena el **hash de la contraseña** (scrypt).
- **Session** — sesiones activas (token, expiración, IP/user-agent).
- **Verification** — tokens temporales (p. ej. verificación de email, si se habilita).
- **Passkey** — credenciales WebAuthn registradas por el usuario (clave pública, contador…).

> Los nombres de campo de estas tablas los fija Better Auth y no deben renombrarse.

## Configuración global (gestionada por el admin)

- **Secret** — claves de API de terceros **cifradas** en reposo (OpenRouter, Tavily,
  Google CSE). La `key` identifica el secreto (p. ej. `openrouter_api_key`).
- **AppSetting** — ajustes no sensibles en claro (proveedor de búsqueda activo, id del
  motor de Google CSE…).
- **PipelineStepConfig** — modelo y prompt por etapa de IA (si falta, se usan los defaults).
  La `stageId` es uno de los `STAGE_IDS`.

## Observabilidad

- **ErrorLog** — registro unificado de errores para el panel de administración. `category`
  es `"auth" | "pipeline" | "server"`; es _best-effort_ (registrarlo nunca debe tumbar el
  flujo que falló) y `userId` es opcional (un login fallido no tiene usuario conocido).

## Entidades de dominio (PostIA)

- **GenerationRun** — una ejecución del pipeline para un tema dado. Su `status` recorre:

  ```
  researching → awaiting_review → awaiting_blueprint_review → generating → completed | failed
  ```

  Las pausas de revisión humana (`awaiting_review` tras los hechos,
  `awaiting_blueprint_review` tras la estructura) son **opcionales** según el tipo de
  noticia. `contextJson` guarda un snapshot serializado del `PipelineContext` para **pausar**
  y **reanudar** la generación. Las fuentes **no** viajan en ese JSON (pesan demasiado): se
  normalizan en `GenerationSource` y se rehidratan al reanudar/revisar.

- **GenerationSource** — fuente de investigación de un run (la "fuente de verdad" del
  artículo) con su **contenido ya descargado**. Tabla propia en lugar de serializarse en el
  contexto, porque el cuerpo de varias webs puede pesar cientos de KB.

- **GenerationStep** — traza de cada etapa dentro de una ejecución: qué modelo se usó
  (`null` en `research`/`scrub`, que no usan IA), `status`, `attempt` (el bucle de calidad
  ejecuta etapas varias veces), `durationMs`, tokens y **`costUsd`** (coste estimado
  congelado al generar, a partir de los tokens y los precios de OpenRouter). Permite analizar
  coste y rendimiento por etapa.

- **Article** — artículo final publicable, propiedad de un usuario. Contenido en Markdown,
  `metaDescription`, `slug`, `keywords` (JSON), `metadataJson` (el enriquecimiento:
  titulares alternativos, tags, FAQ, alt de imagen, Schema.org…) y `featuredImagePath`
  (imagen destacada generada por la etapa `feature-image`, si el tipo la activa). Enlaza
  opcionalmente con el run que lo produjo y, si es una revisión (Revision Mode), con su
  artículo **padre** (`parentId`): la vista del artículo muestra las versiones y un diff
  del Markdown entre padre e hijo.

- **Batch / BatchItem** — lote de generación en segundo plano: una lista de temas que el
  worker procesa secuencialmente sin pausas de revisión, con presupuesto opcional en USD
  (`budgetUsd`; al agotarse, los temas restantes quedan `skipped`). Cada item congela el
  coste de su run (`costUsd`) y enlaza con el artículo resultante.

## Relaciones

```
User 1───∞ Article
User 1───∞ GenerationRun
User 1───∞ Batch
Batch 1───∞ BatchItem
GenerationRun 1───∞ GenerationStep
GenerationRun 1───∞ GenerationSource
GenerationRun 1───0..1 Article   (la ejecución que culmina produce un artículo)
```

> Los campos exactos de cada entidad están en [`prisma/schema.prisma`](../prisma/schema.prisma),
> documentados con comentarios. Las migraciones aplicadas viven en `prisma/migrations/`.
