import { getCurrentSession } from "@/lib/auth/session";

/**
 * Errores de autorización. Los consumidores (Server Actions, route handlers) los traducen
 * a la respuesta adecuada (401/403 o redirección).
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

/** Devuelve la sesión o lanza si no hay usuario autenticado. */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
}

/** Indica si la sesión actual pertenece a un administrador. */
export async function isAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return session?.user?.role === "admin";
}

/** Devuelve la sesión solo si es admin; si no, lanza. Úsalo en toda acción de administración. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new ForbiddenError();
  return session;
}
