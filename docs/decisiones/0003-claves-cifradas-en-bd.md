# ADR 0003 — Claves de API cifradas en la base de datos

- **Estado:** aceptada
- **Fecha:** 2026-06-20

## Contexto

La app necesita una clave de API de OpenRouter (y de un buscador) para funcionar. Se quería
poder **configurarlas desde un panel de administración**, no solo por fichero. Surge la
pregunta: ¿en `.env` o en la base de datos?

## Decisión

La clave es **única y global** (la pone el administrador; todos generan con ella) y se
gestiona desde la UI, así que se guarda **cifrada en la base de datos**:

- Cifrado **AES-256-GCM** (autenticado: detecta manipulación) con IV aleatorio por valor.
- La **clave maestra (KEK)** vive en `env.ENCRYPTION_KEY` (32 bytes), nunca en la BD.
- El valor en claro **nunca** se devuelve al cliente: en la UI solo se ve enmascarado
  (`••••1234`).
- Solo el rol **admin** puede leer el estado o cambiar las claves (autorización revalidada
  en cada Server Action).

## Alternativas y matiz

- **`.env` puro:** es el sitio canónico para un secreto único y no requiere gestionar
  cifrado. Habría sido perfectamente válido y más simple. Se descartó únicamente porque se
  quería edición desde la UI.
- Importante: cifrar en BD **no es más seguro** que `.env` para un secreto único — solo
  desplaza la raíz de confianza a `ENCRYPTION_KEY` (que sigue en `.env`). Aporta
  flexibilidad (UI, y la puerta abierta a claves por usuario en el futuro), a cambio de algo
  más de complejidad.

## Consecuencias

- (+) Claves gestionables desde el panel sin tocar ficheros ni redeploy.
- (+) Patrón de cifrado en reposo reutilizable y testeado (round-trip + integridad).
- (−) Hay que custodiar `ENCRYPTION_KEY`: si se pierde, los secretos cifrados son irrecuperables.
