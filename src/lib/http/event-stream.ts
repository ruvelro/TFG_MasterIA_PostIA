/**
 * Construye una `Response` en streaming que emite eventos como **NDJSON** (un objeto JSON
 * por línea). El `producer` recibe una función `emit` para ir enviando eventos; cuando su
 * promesa resuelve, el stream se cierra. Si lanza, se emite un evento de error final.
 *
 * NDJSON sobre una respuesta abierta (no EventSource) porque el disparo es un POST con
 * cuerpo (tema, overrides, hechos) y necesitamos enviar y recibir en la misma petición.
 */
export function streamJsonEvents<E>(
  producer: (emit: (event: E) => void, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  // Se aborta cuando el cliente cancela/cierra el stream (p. ej. botón "Cancelar"): permite
  // que el productor detenga el pipeline y, sobre todo, las llamadas de IA en curso.
  const controller = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const write = (value: unknown) =>
        streamController.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        await producer((event) => write(event), controller.signal);
      } catch (error) {
        // Si el cliente ya canceló, no intentamos escribir: la conexión no está.
        if (!controller.signal.aborted) {
          const message =
            error instanceof Error ? error.message : "Error desconocido en la generación";
          write({ type: "error", message });
        }
      } finally {
        try {
          streamController.close();
        } catch {
          // El stream ya estaba cerrado tras la cancelación; nada que hacer.
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
