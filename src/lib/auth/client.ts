import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

/**
 * Cliente de Better Auth para el navegador. Sin `baseURL`: usa el mismo origen que la
 * página, lo que evita tener que exponer una variable pública con la URL.
 *
 * El plugin de passkey añade `authClient.passkey.*` (registrar/usar passkeys).
 */
export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
