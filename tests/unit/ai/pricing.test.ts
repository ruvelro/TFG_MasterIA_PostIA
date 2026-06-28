import { afterEach, describe, expect, it, vi } from "vitest";

import {
  estimateCostUsd,
  getModelPricing,
  resetPricingCache,
  type PricingTable,
} from "@/lib/ai/pricing";

afterEach(() => {
  vi.restoreAllMocks();
  resetPricingCache();
});

describe("estimateCostUsd", () => {
  const table: PricingTable = new Map([
    ["google/gemini-2.5-flash", { prompt: 1e-7, completion: 4e-7 }],
  ]);

  it("multiplica tokens por el precio del modelo", () => {
    // 1000 * 1e-7 + 500 * 4e-7 = 1e-4 + 2e-4 = 3e-4
    expect(estimateCostUsd(table, "google/gemini-2.5-flash", 1000, 500)).toBeCloseTo(3e-4, 10);
  });

  it("devuelve null si no hay modelo", () => {
    expect(estimateCostUsd(table, null, 1000, 500)).toBeNull();
  });

  it("devuelve null si el modelo no está en el catálogo", () => {
    expect(estimateCostUsd(table, "modelo/desconocido", 1000, 500)).toBeNull();
  });

  it("trata los tokens ausentes como 0", () => {
    expect(estimateCostUsd(table, "google/gemini-2.5-flash", null, null)).toBe(0);
  });
});

describe("getModelPricing", () => {
  it("parsea el catálogo de OpenRouter y descarta precios no numéricos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: "a/modelo", pricing: { prompt: "0.0000001", completion: "0.0000004" } },
            { id: "b/sin-precio", pricing: { prompt: "n/a", completion: "0.0000004" } },
          ],
        }),
      })),
    );

    const table = await getModelPricing();
    expect(table.get("a/modelo")).toEqual({ prompt: 1e-7, completion: 4e-7 });
    expect(table.has("b/sin-precio")).toBe(false);
  });

  it("devuelve un mapa vacío si la consulta falla (best-effort)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("red caída");
      }),
    );

    const table = await getModelPricing();
    expect(table.size).toBe(0);
  });
});
