import bcrypt from "bcryptjs";

// Coste de bcrypt (2^12 iteraciones). 12 es un equilibrio razonable en 2026 entre
// resistencia a fuerza bruta y latencia de login; subirlo encarece cada verificación.
const SALT_ROUNDS = 12;

/** Genera el hash de una contraseña en claro. Nunca almacenamos la contraseña original. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compara una contraseña en claro con su hash. bcrypt.compare es resistente a timing. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
