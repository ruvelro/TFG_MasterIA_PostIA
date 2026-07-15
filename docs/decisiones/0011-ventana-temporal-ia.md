# ADR 0011 — Ventana temporal de llamadas de IA

- **Estado:** aceptada
- **Fecha:** 2026-07-15

## Contexto

El timeout global de 120 segundos resultó insuficiente para una ejecución real de `fixer`. Esta
etapa combina un prompt largo con un objeto estructurado que contiene metadata y el artículo
completo. Además, la señal temporal envuelve la llamada completa del AI SDK, incluidos sus
reintentos internos, por lo que cada intento del proveedor no dispone de 120 segundos propios.

## Decisión

- Elevar el timeout predeterminado de 120 a 300 segundos.
- Centralizar valor predeterminado y límites en `lib/config/ai-timeout.ts` para que cliente de IA,
  configuración y Admin compartan el mismo contrato.
- Permitir ajustes manuales entre 10 y 600 segundos.
- Aplicar una migración de datos que eleve a 300 segundos únicamente los valores persistidos
  inferiores. Una configuración manual superior se conserva.
- Mantener dos reintentos como valor de fábrica: ampliar también su número multiplicaría coste y
  duración y no resolvería una respuesta válida que simplemente necesita más tiempo.

## Alternativas descartadas

- **Eliminar el timeout:** una petición abandonada por el proveedor podría bloquear el stream y
  mantener recursos ocupados indefinidamente.
- **Añadir reintentos:** un aborto temporal no es necesariamente transitorio y reiniciar una salida
  larga vuelve a consumir tokens desde cero.
- **Aplicar un multiplicador oculto solo a fixer:** haría que el valor mostrado en Admin no
  representase el comportamiento real y dejaría otras salidas estructuradas expuestas.

## Consecuencias

- (+) Las salidas largas disponen de 2,5 veces más margen de fábrica.
- (+) La instalación Docker actualiza el valor antiguo durante `prisma migrate deploy`.
- (+) El operador puede ampliar hasta 10 minutos para modelos especialmente lentos.
- (−) Un proveedor bloqueado tarda más en fallar, aunque la cancelación manual sigue abortando la
  llamada inmediatamente.
