#!/bin/sh
# Arranque del contenedor: aplica las migraciones pendientes y levanta el servidor.
# `set -e` aborta si la migración falla (no queremos arrancar con un esquema desfasado).
set -e

echo "→ Aplicando migraciones de base de datos…"
node_modules/.bin/prisma migrate deploy

echo "→ Iniciando PostIA en el puerto 3000…"
# `exec` reemplaza el shell para que Next reciba las señales (SIGTERM) como PID 1.
exec node_modules/.bin/next start -H 0.0.0.0 -p 3000
