// Expone todos los endpoints de Better Auth (registro, login, sesión, passkeys, logout)
// bajo /api/auth/*.
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
