/**
 * Construye una `Response` en streaming que emite eventos como **NDJSON** (un objeto JSON
 * por línea). El `producer` recibe una función `emit` para ir enviando eventos; cuando su
 * promesa resuelve, el stream se cierra. Si lanza, se emite un evento de error final.
 *
 * NDJSON sobre una respuesta abierta (no EventSource) porque el disparo es un POST con
 * cuerpo (tema, overrides, hechos) y necesitamos enviar y recibir en la misma petición.
 */
export function streamJsonEvents<E>(
  producer: (emit: (event: E) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (value: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        await producer((event) => write(event));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido en la generación";
        write({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
