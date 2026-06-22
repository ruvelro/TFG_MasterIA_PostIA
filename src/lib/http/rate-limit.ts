/**
 * Limitador de tasa en memoria por clave (p. ej. id de usuario), con ventana fija.
 *
 * Es una defensa simple para acotar el coste de la generación con IA y el abuso del
 * endpoint. Al ser en memoria, el contador es por instancia y se reinicia al reiniciar el
 * servidor: suficiente para el alcance del TFG (en producción multi-instancia se usaría
 * un almacén compartido como Redis).
 */
export interface RateLimiter {
  /** Devuelve true si la petición se permite, false si supera el límite en la ventana. */
  check(key: string): boolean;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key) {
      const now = Date.now();
      const bucket = buckets.get(key);

      if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) return false;

      bucket.count += 1;
      return true;
    },
  };
}

// Límite del endpoint de generación: 10 generaciones por minuto y usuario.
export const generateRateLimiter = createRateLimiter(10, 60_000);
