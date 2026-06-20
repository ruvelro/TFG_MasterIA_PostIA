import { describe, expect, it } from "vitest";

import { resolveStepConfig } from "@/lib/ai/resolve-step";
import { DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";

describe("resolveStepConfig", () => {
  it("usa los valores por defecto cuando no hay nada guardado ni override", () => {
    expect(resolveStepConfig("outline")).toEqual(DEFAULT_STEP_CONFIG.outline);
  });

  it("la configuración guardada gana a los valores por defecto", () => {
    const result = resolveStepConfig("draft", { model: "openai/gpt-4o-mini" });
    expect(result.model).toBe("openai/gpt-4o-mini");
    // El prompt no guardado cae al por defecto.
    expect(result.prompt).toBe(DEFAULT_STEP_CONFIG.draft.prompt);
  });

  it("el override puntual gana a todo", () => {
    const result = resolveStepConfig(
      "validate",
      { model: "guardado/modelo", prompt: "guardado" },
      { model: "override/modelo", prompt: "override" },
    );
    expect(result).toEqual({ model: "override/modelo", prompt: "override" });
  });

  it("ignora valores vacíos o en blanco y cae al siguiente nivel", () => {
    const result = resolveStepConfig("outline", { model: "   " }, { model: "" });
    expect(result.model).toBe(DEFAULT_STEP_CONFIG.outline.model);
  });
});
