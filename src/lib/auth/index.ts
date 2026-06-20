import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";

// Punto de entrada de Auth.js. `auth` se usa en Server Components/Actions y Route Handlers
// para leer la sesión; `handlers` alimenta la ruta /api/auth; `signIn`/`signOut` el login.
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
