import { describe, expect, it } from "vitest";

import { readGeneratedImage } from "@/lib/images/storage";

/**
 * La seguridad crítica del almacenamiento es que una ruta guardada en BD NUNCA saque la lectura
 * del directorio de imágenes generadas (path traversal). Se prueba que rutas manipuladas se
 * rechazan ANTES de tocar el disco, con el mismo error explícito.
 */
describe("seguridad de rutas de readGeneratedImage", () => {
  it("rechaza rutas con salto de directorio", async () => {
    await expect(readGeneratedImage("../../etc/passwd")).rejects.toThrow("Ruta de imagen inválida");
  });

  it("rechaza rutas fuera del directorio de imágenes generadas", async () => {
    await expect(readGeneratedImage("uploads/featured/otra.png")).rejects.toThrow(
      "Ruta de imagen inválida",
    );
  });
});
