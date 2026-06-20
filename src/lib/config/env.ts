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
