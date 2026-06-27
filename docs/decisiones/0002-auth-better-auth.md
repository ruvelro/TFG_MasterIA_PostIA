# ADR 0002 — Autenticación con Better Auth (registro, contraseñas fuertes, passkeys)

- **Estado:** aceptada (sustituye la decisión de auth del ADR 0001 / Fase 2 inicial)
- **Fecha:** 2026-06-20

## Contexto

La Fase 2 implementó autenticación con Auth.js (NextAuth) v5 y un usuario "demo" sembrado.
Al revisar la seguridad surgieron tres requisitos:

1. **No debe existir ningún usuario predefinido**: el primer acceso se hace registrándose.
2. **Contraseñas seguras obligatorias** en el registro.
3. **Passkeys (WebAuthn)** como método de acceso adicional opcional.

Además, NextAuth v5 sigue en _beta_ y su soporte de WebAuthn es **experimental** y obliga
a usar el adaptador de base de datos, lo que encajaba mal con nuestra configuración.

## Decisión

Migrar a **Better Auth** (estable, no beta):

- **Registro abierto** en `/register`; `autoSignIn` deja al usuario logueado al crear la cuenta.
- **Política de contraseñas fuertes** (≥12 caracteres; mayúscula, minúscula, número y
  símbolo; lista de bloqueo de comunes) definida una vez con Zod y aplicada en **dos
  capas**: el formulario (UX) y un **hook `before` de servidor** (garantía infranqueable).
- **Passkeys** con el plugin oficial `@better-auth/passkey` (gestionables en `/account`).
- Se elimina el usuario demo y el `seed`; bcrypt se sustituye por el hash scrypt de Better Auth.

## Alternativas descartadas

- **Seguir con NextAuth v5 + WebAuthn experimental:** dependencia beta + provider
  experimental para algo de seguridad; más difícil de justificar en un TFG.
- **Auth propia con WebAuthn a mano:** gran superficie de error criptográfico.

## Consecuencias

- (+) Librería estable con email+contraseña y passkeys de primera clase.
- (+) La política de contraseñas es testeable y se aplica en servidor.
- (+) Verificado de extremo a extremo, incluida la passkey (autenticador virtual en e2e).
- (−) Better Auth gestiona varias tablas (User/Account/Session/Verification/Passkey) cuyos
  campos no deben renombrarse.
- (−) Para el requisito (f) del TFG ya no hay credenciales fijas: el README explica el registro.
