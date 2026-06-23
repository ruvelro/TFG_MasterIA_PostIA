# Despliegue con Docker (VPS)

PostIA se empaqueta como una imagen Docker lista para producción y se levanta con Docker
Compose. Pensado para un VPS, con todos los secretos en `.env` y endurecimiento básico.

## Requisitos

- Docker y Docker Compose v2 en el servidor.

## Pasos

```bash
# 1. Clonar el repositorio en el VPS
git clone <repo> postia && cd postia

# 2. Crear el .env a partir de la plantilla
cp .env.example .env

# 3. Generar los secretos (cada comando, un valor distinto)
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY

# 4. Editar .env:
#    - AUTH_SECRET y ENCRYPTION_KEY con los valores generados
#    - APP_URL con la URL pública real, p. ej. http://TU_IP:38291  (o tu dominio)
#    - APP_PORT si quieres otro puerto de host (por defecto 38291)

# 5. Construir y arrancar
docker compose up -d --build
```

La app queda en `http://TU_IP:38291` (o el `APP_PORT` que definas).

## Primer uso

1. Entra y **regístrate**: el **primer usuario** se convierte en administrador.
2. Ve a **/admin** y configura la **clave de OpenRouter** y la de un buscador (Tavily o
   Google CSE). Sin ellas, la generación real no funciona (el resto de la app sí).

## Operación

- **Migraciones:** se aplican solas al arrancar el contenedor (`prisma migrate deploy` en el
  entrypoint), también al actualizar.
- **Actualizar:** `git pull && docker compose up -d --build`.
- **Logs:** `docker compose logs -f`.
- **Parar / arrancar:** `docker compose down` / `docker compose up -d`.

## Datos y backups

- La base de datos SQLite vive en el **volumen** `postia-data` (montado en `/data`), así que
  **persiste** entre reinicios y reconstrucciones.
- Backup: `docker run --rm -v tfg_masteria_postia_postia-data:/data -v "$PWD":/backup alpine \
tar czf /backup/postia-data.tgz -C /data .` (ajusta el nombre del volumen si difiere).

## Seguridad aplicada

- Imagen multi-stage: el runtime no incluye toolchain ni dependencias de desarrollo.
- El proceso corre como **usuario no-root** (`node`, uid 1000).
- `no-new-privileges`, `cap_drop: ALL`, `/tmp` efímero (`tmpfs`).
- Los **secretos nunca están en la imagen**: se inyectan en runtime desde `.env` (`env_file`);
  `.env` está en `.gitignore` y en `.dockerignore`.
- Cabeceras de seguridad (CSP, X-Frame-Options, HSTS…) servidas por la app.
- Healthcheck en `/api/health`.

## Recomendado para producción real

- Poner PostIA **detrás de un reverse proxy** (Caddy o Nginx) con **TLS/HTTPS**. Las passkeys
  (WebAuthn) y la cabecera HSTS requieren HTTPS para funcionar plenamente; en ese caso, fija
  `APP_URL=https://tu-dominio`. El proxy reenvía a `127.0.0.1:${APP_PORT}`.
