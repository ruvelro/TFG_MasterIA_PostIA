import { z } from "zod";

import { passwordSchema } from "./password";

// Esquema de registro: nombre + email + contraseña fuerte (política en password.ts).
// Normalizamos email a minúsculas y recortamos espacios para evitar duplicados por formato.
export const registerSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres" }).max(80),
  email: z.email({ error: "Introduce un email válido" }).trim().toLowerCase(),
  password: passwordSchema,
});

// Esquema de login: aquí NO repetimos la política de complejidad (una contraseña antigua
// podría no cumplir la política actual); basta con que no esté vacía y el email sea válido.
export const loginSchema = z.object({
  email: z.email({ error: "Introduce un email válido" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Introduce tu contraseña" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
