import { z } from "zod";

import { COMMON_PASSWORDS } from "./common-passwords";

/**
 * Política de contraseñas seguras para el registro.
 *
 * Exigimos longitud y variedad (mayúscula, minúscula, número y símbolo) y rechazamos las
 * contraseñas notoriamente comunes. Esta misma política se aplica en dos sitios para que
 * sea infranqueable: en el formulario de registro (feedback inmediato) y en un hook de
 * servidor de Better Auth (garantía real, ver src/lib/auth/index.ts).
 */
export const passwordSchema = z
  .string()
  .min(12, { error: "La contraseña debe tener al menos 12 caracteres" })
  .max(128, { error: "La contraseña no puede superar los 128 caracteres" })
  .regex(/[a-z]/, { error: "Incluye al menos una letra minúscula" })
  .regex(/[A-Z]/, { error: "Incluye al menos una letra mayúscula" })
  .regex(/[0-9]/, { error: "Incluye al menos un número" })
  .regex(/[^A-Za-z0-9]/, { error: "Incluye al menos un símbolo" })
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    error: "Esta contraseña es demasiado común; elige otra",
  });

/** Devuelve el primer mensaje de error de la política, o null si la contraseña es válida. */
export function getPasswordError(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  return result.success ? null : result.error.issues[0].message;
}
