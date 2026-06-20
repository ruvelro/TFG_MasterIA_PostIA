import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { passwordSchema } from "@/lib/validation/password";

// Derivamos el dominio (rpID) y el origen para WebAuthn desde APP_URL: en local serán
// "localhost" y "http://localhost:3000"; en producción, el dominio real.
const appUrl = new URL(env.APP_URL);

/**
 * Instancia de Better Auth (servidor).
 *
 * - Persistencia con el adaptador Prisma sobre SQLite.
 * - Email + contraseña con auto-login tras el registro (registro abierto).
 * - Passkeys (WebAuthn) como método adicional opcional.
 * - Hook `before` que aplica nuestra política de contraseñas fuertes EN EL SERVIDOR, de
 *   modo que no se pueda saltar llamando directamente a la API sin pasar por el formulario.
 */
export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Solo nos interesa el alta por email: validamos la contraseña con la política
      // completa (complejidad + lista de bloqueo) antes de que se cree la cuenta.
      if (ctx.path !== "/sign-up/email") return;

      const result = passwordSchema.safeParse(ctx.body?.password);
      if (!result.success) {
        throw new APIError("BAD_REQUEST", { message: result.error.issues[0].message });
      }
    }),
  },
  plugins: [
    passkey({ rpID: appUrl.hostname, rpName: "PostIA", origin: env.APP_URL }),
    // `nextCookies` debe ir EL ÚLTIMO: permite a Better Auth fijar cookies de sesión desde
    // Server Actions y route handlers de Next.js.
    nextCookies(),
  ],
});
