# API pública

PostIA expone la generación como API autenticada por **claves por usuario**, pensada para
integraciones (CMS, automatizaciones). Cada usuario crea y revoca sus claves en
**Cuenta → Claves de API**; la clave en claro se muestra una única vez (en la BD solo vive
su hash SHA-256: son secretos aleatorios de 256 bits, no hace falta un KDF lento).

Los **límites de tasa** y el **presupuesto diario de coste** aplican igual que en la web,
sobre el usuario propietario de la clave.

## Autenticación

Cabecera en todas las peticiones:

```
Authorization: Bearer postia_…
```

## Endpoints

### `POST /api/v1/generate`

Inicia una generación y transmite el progreso en **NDJSON** (el mismo streaming que usa la
UI): un objeto JSON por línea con eventos `stage` y, al final, `completed` con el artículo.
Las pausas de revisión humana van desactivadas (la API es desatendida).

```bash
curl -N https://tu-postia.example/api/v1/generate \
  -H "Authorization: Bearer $POSTIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Tendencias de energía solar en 2026", "newsTypeId": "estandar"}'
```

Cuerpo: `topic` (obligatorio), `context`, `newsTypeId`, `lengthPresetId`, `overrides`
(mismo contrato que la generación web; los modelos de los overrides se validan contra la
allowlist del administrador).

### `GET /api/v1/articles/{id}`

Devuelve un artículo del usuario en JSON (`title`, `slug`, `contentMarkdown`,
`metaDescription`, `keywords`, `metadata` con el enriquecimiento). Un artículo ajeno
responde 404.

## Errores

| Código | Motivo                                        |
| ------ | --------------------------------------------- |
| 401    | Clave ausente, inválida o revocada            |
| 400    | Cuerpo inválido (mensaje de Zod en el cuerpo) |
| 429    | Límite de tasa o presupuesto diario agotado   |
