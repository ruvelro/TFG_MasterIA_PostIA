import { z } from "zod";

/**
 * Validación centralizada de variables de entorno del SERVIDOR.
 *
 * Decisión de diseño (seguridad por defecto + fail-fast): validamos `process.env`
 * una sola vez al cargar el módulo. Si falta una variable obligatoria o tiene un
 * formato inválido, la aplicación falla al arrancar con un mensaje claro, en lugar
 * de romperse a mitad de una petición con un error opaco (o, peor, ejecutarse con
 * una configuración insegura). Cada fase del proyecto añade aquí sus propias
 * variables, de modo que este esquema es el contrato único de configuración.
 *
 * Este módulo es solo de servidor: nunca debe importarse desde componentes de
 * cliente, porque expondría la forma de la configuración del backend.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Conexión a la base de datos. Se mantiene como string genérico (no solo `file:`) para
  // poder migrar de SQLite a PostgreSQL cambiando solo el valor, sin tocar el esquema.
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL es obligatoria" }),

  // Secreto con el que Better Auth firma sesiones y tokens. Exigimos una longitud mínima
  // para descartar secretos triviales; genéralo con `openssl rand -base64 32`.
  AUTH_SECRET: z.string().min(16, { error: "AUTH_SECRET debe tener al menos 16 caracteres" }),

  // URL pública de la app. La usa Better Auth como baseURL y para derivar el dominio
  // (rpID) y el origen de las passkeys (WebAuthn). En local apunta a localhost.
  APP_URL: z.url({ error: "APP_URL debe ser una URL válida" }).default("http://localhost:3000"),
});

type ServerEnv = z.infer<typeof serverSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }

  return parsed.data;
}

export const env = parseServerEnv();
