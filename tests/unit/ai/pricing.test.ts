import { afterEach, describe, expect, it, vi } from "vitest";

import {
  estimateCostUsd,
  findModelPrice,
  getModelPricing,
  normalizeModelId,
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

  it("casa un id con sufijo de variante (:free) contra el id base del catálogo", () => {
    // El usuario configura `:free`, pero el catálogo solo tiene el id base: debe estimar igual.
    expect(estimateCostUsd(table, "google/gemini-2.5-flash:free", 1000, 500)).toBeCloseTo(3e-4, 10);
  });
});

describe("normalizeModelId", () => {
  it("recorta el sufijo de routing/variante tras el primer ':'", () => {
    expect(normalizeModelId("vendor/model:free")).toBe("vendor/model");
    expect(normalizeModelId("vendor/model:nitro")).toBe("vendor/model");
  });

  it("deja intacto un id sin sufijo", () => {
    expect(normalizeModelId("vendor/model")).toBe("vendor/model");
  });
});

describe("findModelPrice", () => {
  const price = { prompt: 1e-7, completion: 4e-7 };
  const table: PricingTable = new Map([["vendor/model", price]]);

  it("encuentra por id exacto", () => {
    expect(findModelPrice(table, "vendor/model")).toEqual(price);
  });

  it("encuentra por id normalizado cuando el exacto no está", () => {
    expect(findModelPrice(table, "vendor/model:free")).toEqual(price);
  });

  it("devuelve null si no existe ni exacto ni normalizado", () => {
    expect(findModelPrice(table, "otro/model")).toBeNull();
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

  it("indexa también por id base las variantes con sufijo (:free)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: "a/modelo:free", pricing: { prompt: "0.0000001", completion: "0.0000004" } },
          ],
        }),
      })),
    );

    const table = await getModelPricing();
    expect(table.get("a/modelo:free")).toEqual({ prompt: 1e-7, completion: 4e-7 });
    expect(table.get("a/modelo")).toEqual({ prompt: 1e-7, completion: 4e-7 });
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
