import { describe, expect, it } from "vitest";

import { env } from "@/lib/config/env";

describe("validación de entorno", () => {
  it("expone un NODE_ENV válido", () => {
    // Vitest fija NODE_ENV=test; el esquema debe aceptarlo sin lanzar al importar el módulo.
    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
  });
});
