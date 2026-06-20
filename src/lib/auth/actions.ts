"use server";

import { signOut } from "@/lib/auth";

// Cierra la sesión y devuelve al login. Se invoca desde un <form> en la cabecera.
export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
