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
  /** Número de claves activas en memoria (para monitorización y tests de la purga). */
  size(): number;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  // Última purga de buckets caducados. Sin ella, el Map crecería sin límite (una entrada por
  // clave que nunca se elimina). La purga es perezosa y como mucho una vez por ventana, para
  // no recorrer el Map en cada petición.
  let lastSweepAt = 0;

  function sweepExpired(now: number): void {
    if (now - lastSweepAt < windowMs) return;
    lastSweepAt = now;
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      sweepExpired(now);
      const bucket = buckets.get(key);

      if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) return false;

      bucket.count += 1;
      return true;
    },
    size() {
      return buckets.size;
    },
  };
}

// Límite del endpoint de generación: 10 generaciones por minuto y usuario.
export const generateRateLimiter = createRateLimiter(10, 60_000);
