"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation/auth";

export interface LoginState {
  error?: string;
}

const DEFAULT_REDIRECT = "/generate";

/**
 * Server Action que autentica al usuario. Se ejecuta solo en el servidor, por lo que es
 * un sitio seguro para manejar credenciales.
 *
 * Devuelve un mensaje genérico ("email o contraseña incorrectos") tanto si el email no
 * existe como si la contraseña falla: no distinguir ambos casos evita la enumeración de
 * usuarios. En caso de éxito, `signIn` lanza una redirección que debemos dejar propagar.
 */
export async function authenticate(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Introduce un email válido y una contraseña de al menos 8 caracteres." };
  }

  // Solo aceptamos rutas internas como destino, para evitar *open redirects*.
  const rawCallback = formData.get("callbackUrl");
  const callbackUrl =
    typeof rawCallback === "string" && rawCallback.startsWith("/") ? rawCallback : DEFAULT_REDIRECT;

  // Usamos `redirect: false` para controlar nosotros el flujo: así un fallo de credenciales
  // lanza `AuthError` (que capturamos para mostrar el mensaje) en lugar de redirigir a una
  // página de error de Auth.js, lo que nos dejaría sin forma de renderizar la alerta.
  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos." };
    }
    throw error;
  }

  // Login correcto: redirigimos nosotros. `redirect()` lanza una excepción de control de
  // Next, por eso va FUERA del try (no debe ser capturada).
  redirect(callbackUrl);
}
