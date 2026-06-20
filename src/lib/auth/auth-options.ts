import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { credentialsSchema } from "@/lib/validation/auth";

/**
 * Configuración de Auth.js.
 *
 * Estrategia JWT (no de base de datos) porque el proveedor Credentials no es compatible
 * con sesiones en BD. El secreto y el flujo de login viven aquí; la instancia de NextAuth
 * se crea en `index.ts` para mantener la configuración separada de su instanciación.
 */
export const authOptions: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  // `trustHost` es necesario fuera de Vercel (p. ej. localhost o un servidor propio).
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      // `authorize` decide si las credenciales son válidas. Devolver null = login fallido.
      // No revelamos si el fallo fue por email inexistente o contraseña incorrecta, para
      // no facilitar la enumeración de usuarios.
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Propagamos el id del usuario al token y de ahí a la sesión, para autorizar por dueño.
    jwt: ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
