# ─────────────────────────────────────────────────────────────────────────────
# PostIA — imagen de producción (multi-stage).
#
# Buenas prácticas aplicadas:
# - Build separado del runtime → la imagen final no lleva toolchain ni dev-deps.
# - Usuario NO root en runtime.
# - Sin secretos en la imagen: se inyectan en runtime (env_file del compose).
# - El cliente de Prisma se genera en el build (reproducible) y el binario nativo de
#   better-sqlite3 se compila en el build, en la misma base que el runtime.
# ─────────────────────────────────────────────────────────────────────────────

# ── Etapa de build ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Toolchain para compilar el módulo nativo de better-sqlite3 (solo en el build).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Husky no debe ejecutarse en el contenedor (no hay repo git).
ENV HUSKY=0

# Copiamos primero los manifiestos y el esquema: el `postinstall` (prisma generate) necesita
# el esquema, y así aprovechamos la caché de capas cuando solo cambia el código.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# Resto del código y build de producción.
COPY . .

# Variables PLACEHOLDER solo para el build: `next build` evalúa los módulos (incluida la
# validación fail-fast de `lib/config/env`), que exige estas variables. NO son secretos ni
# acaban en la imagen final (esta etapa se descarta); los valores reales se inyectan en
# runtime vía env_file. ENCRYPTION_KEY debe ser base64 de 32 bytes para pasar la validación.
ENV DATABASE_URL="file:/tmp/build.db" \
    AUTH_SECRET="build-time-placeholder-not-a-real-secret" \
    ENCRYPTION_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
RUN npx tsx scripts/export-runtime-defaults.ts /tmp/runtime-defaults.json
RUN npm run build

# Elimina las dependencias de desarrollo (prisma y dotenv son dependencies, se conservan
# para aplicar migraciones en el arranque). No recompila el binario nativo ya construido.
RUN npm prune --omit=dev

# ── Etapa de runtime ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl: requerido por las herramientas de Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Directorios de datos (SQLite) y de subidas (imágenes destacadas) propiedad del usuario
# no-root; los volúmenes nombrados del compose heredan esta propiedad al crearse, de modo
# que el proceso pueda escribir la base de datos y las imágenes generadas.
RUN mkdir -p /data /app/uploads/featured \
  && chown -R node:node /data /app/uploads

# Copiamos solo lo necesario para ejecutar, con propiedad del usuario node.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/src/generated ./src/generated
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/scripts/sync-runtime-defaults.mjs ./scripts/sync-runtime-defaults.mjs
COPY --from=builder --chown=node:node /tmp/runtime-defaults.json ./runtime-defaults.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000

# Aplica migraciones y arranca el servidor (ver script).
ENTRYPOINT ["./docker-entrypoint.sh"]
