import { describe, expect, it } from "vitest";

import { resumeGenerationSchema, startGenerationSchema } from "@/lib/validation/generation";

describe("startGenerationSchema", () => {
  it("acepta un tema válido y aplica pauseForReview por defecto", () => {
    const parsed = startGenerationSchema.parse({ topic: "Energía solar en 2026" });
    expect(parsed.pauseForReview).toBe(true);
  });

  it("rechaza temas demasiado cortos", () => {
    expect(startGenerationSchema.safeParse({ topic: "ia" }).success).toBe(false);
  });

  it("admite overrides por etapa de IA válida", () => {
    const result = startGenerationSchema.safeParse({
      topic: "Coches eléctricos",
      overrides: { draft: { model: "openai/gpt-4o-mini" } },
    });
    expect(result.success).toBe(true);
  });

  it("rechaza overrides con una etapa desconocida", () => {
    const result = startGenerationSchema.safeParse({
      topic: "Coches eléctricos",
      overrides: { research: { model: "x" } },
    });
    expect(result.success).toBe(false);
  });
});

describe("resumeGenerationSchema", () => {
  it("requiere los hechos editados con su forma", () => {
    expect(
      resumeGenerationSchema.safeParse({
        editedFacts: { facts: [{ claim: "c", source: "https://x" }] },
      }).success,
    ).toBe(true);
    expect(resumeGenerationSchema.safeParse({}).success).toBe(false);
  });
});
