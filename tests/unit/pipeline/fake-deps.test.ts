import { describe, expect, it } from "vitest";

import { createFakePipelineDeps } from "@/lib/pipeline/fake-deps";

describe("dependencias falsas del pipeline", () => {
  it("mantiene resultados distintos por consulta para probar la expansión y el fallback literal", async () => {
    const deps = createFakePipelineDeps();
    const expanded = await deps.search("consulta complementaria", 2);
    const literal = await deps.search("tema literal", 2);

    expect(new URL(expanded[0].url).hostname).not.toBe(new URL(literal[0].url).hostname);
    expect(expanded[0].title).toContain("consulta complementaria");
    expect(literal[0].title).toContain("tema literal");
  });
});
