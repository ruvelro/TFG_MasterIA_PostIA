import { describe, expect, it } from "vitest";

import { cosineSimilarity } from "@/lib/embeddings/similarity";

describe("cosineSimilarity", () => {
  it("es 1 para vectores idénticos y 0 para ortogonales", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("es -1 para vectores opuestos", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("devuelve 0 con vectores vacíos, de distinta dimensión o nulos", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});
