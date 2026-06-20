// Expone los endpoints de Auth.js (login, logout, callback, sesión) bajo /api/auth/*.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
