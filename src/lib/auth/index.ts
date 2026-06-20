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
// Flag operativo solo para los tests e2e: permite desactivar el rate limiting (que de otro
// modo bloquea la suite, que hace muchas peticiones de auth seguidas desde una sola IP).
// No es configuración de la app, por eso se lee directamente y no desde `env`.
const isE2E = process.env.E2E === "true";

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  // Rate limiting como defensa frente a fuerza bruta y abuso de los endpoints de auth.
  // Activo en producción; desactivado en e2e para que los tests sean deterministas.
  rateLimit: {
    enabled: !isE2E,
    window: 60,
    max: 50,
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      // Exponemos el rol en la sesión para autorizar sin una consulta extra. `input: false`
      // impide que el usuario se asigne un rol a sí mismo en el registro.
      role: { type: "string", required: false, input: false, defaultValue: "user" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Bootstrap de administrador: el PRIMER usuario registrado se promueve a admin,
          // para que exista alguien que pueda configurar las claves y el pipeline. No hay
          // forma de auto-asignarse admin después (el campo `role` no es editable por API).
          const userCount = await prisma.user.count();
          if (userCount === 1) {
            await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
          }
        },
      },
    },
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
