# ADR 0007 — Versionado del payload cifrado y rotación de la KEK

- **Estado:** aceptada
- **Fecha:** 2026-07-10

## Contexto

Los secretos de terceros se cifran en reposo con AES-256-GCM (ADR 0003) y la clave
maestra (KEK) vive en `ENCRYPTION_KEY`. El payload original (`iv.tag.ciphertext`) no
identificaba con qué clave se cifró: **rotar la KEK dejaba ilegibles todos los secretos
guardados**, y la única salida era reintroducirlos a mano. Una clave que no se puede
rotar sin pérdida es una limitación operativa y una mala práctica (si la KEK se filtra,
conviene poder sustituirla de forma ordenada).

## Decisión

1. **Payload versionado:** `encryptSecret` emite `v1.iv.tag.ciphertext`. La versión
   identifica el esquema (algoritmo + formato), de modo que un cambio futuro (p. ej. otro
   algoritmo) pueda convivir con los payloads existentes. El formato legado sin versión
   se sigue aceptando.
2. **Ventana de rotación con dos claves:** durante una rotación, la clave nueva va en
   `ENCRYPTION_KEY` y la anterior en `ENCRYPTION_KEY_PREVIOUS` (opcional, validada
   igual). El descifrado prueba la clave actual y, si el tag de autenticación no cuadra,
   cae a la anterior.
3. **Re-cifrado perezoso:** `decryptSecretDetailed` devuelve `needsRotation` cuando el
   payload se descifró con la clave anterior o venía en formato legado; el repositorio de
   secretos (`lib/settings/secrets.ts`) re-cifra en ese momento con la clave actual
   (best-effort: un fallo de escritura no rompe la lectura). Como los secretos son pocos
   y se leen en cada generación, la migración completa ocurre de forma natural en poco
   tiempo; después se retira `ENCRYPTION_KEY_PREVIOUS`.

### Procedimiento de rotación

1. Generar clave nueva: `openssl rand -base64 32`.
2. Mover el valor actual de `ENCRYPTION_KEY` a `ENCRYPTION_KEY_PREVIOUS` y poner la
   clave nueva en `ENCRYPTION_KEY`. Redesplegar.
3. Usar la app con normalidad (o leer cada secreto una vez): cada lectura re-cifra.
4. Retirar `ENCRYPTION_KEY_PREVIOUS` y redesplegar.

## Alternativas

- **Script de migración explícito:** re-cifrar todo en un paso. Más determinista, pero
  añade una pieza operativa que hay que ejecutar y mantener; con el volumen actual de
  secretos (unidades) el re-cifrado perezoso converge igual de rápido y no requiere
  intervención. Si algún día los secretos se cuentan por miles (p. ej. claves por
  usuario), un script batch sería el complemento natural — el formato versionado ya lo
  permite.
- **KMS externo (AWS KMS, Vault):** resuelve rotación y custodia, pero introduce una
  dependencia de infraestructura desproporcionada para el alcance del TFM.

## Consecuencias

- (+) La KEK se puede rotar sin pérdida de datos ni intervención manual sobre la BD.
- (+) El esquema de cifrado es evolucionable (la versión del payload lo desacopla).
- (−) Durante la ventana de rotación conviven dos claves en el entorno: hay que
  recordar retirar `ENCRYPTION_KEY_PREVIOUS` (la app funciona igual si se olvida, pero
  la clave vieja seguiría siendo material sensible).
