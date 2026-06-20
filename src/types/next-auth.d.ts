import type { DefaultSession } from "next-auth";

// Augmentación de tipos de Auth.js: exponemos el id del usuario en la sesión para poder
// filtrar recursos por propietario (artículos, ejecuciones) con tipado fuerte.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
