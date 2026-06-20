import { z } from "zod";

// Esquema único de credenciales: lo usan tanto el formulario de login como el callback
// `authorize` de Auth.js, de modo que cliente y servidor validan exactamente lo mismo.
export const credentialsSchema = z.object({
  email: z.email({ error: "Introduce un email válido" }),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
});

export type Credentials = z.infer<typeof credentialsSchema>;
