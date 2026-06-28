import { describe, expect, it } from "vitest";

import {
  assertOverrideModelsAllowed,
  OverrideModelNotAllowedError,
  resolveStepConfig,
} from "@/lib/ai/resolve-step";
import { DEFAULT_STEP_CONFIG } from "@/lib/pipeline/default-config";

describe("resolveStepConfig", () => {
  it("usa los valores por defecto cuando no hay nada guardado ni override", () => {
    expect(resolveStepConfig("extract")).toEqual(DEFAULT_STEP_CONFIG.extract);
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
    const result = resolveStepConfig("extract", { model: "   " }, { model: "" });
    expect(result.model).toBe(DEFAULT_STEP_CONFIG.extract.model);
  });
});

describe("assertOverrideModelsAllowed", () => {
  const allowed = new Set(["openai/gpt-4o-mini", "google/gemini-2.5-flash"]);

  it("no lanza si no hay overrides", () => {
    expect(() => assertOverrideModelsAllowed(undefined, allowed)).not.toThrow();
  });

  it("permite un override cuyo modelo está en la allowlist", () => {
    expect(() =>
      assertOverrideModelsAllowed({ draft: { model: "openai/gpt-4o-mini" } }, allowed),
    ).not.toThrow();
  });

  it("rechaza un override con un modelo fuera de la allowlist", () => {
    expect(() =>
      assertOverrideModelsAllowed({ draft: { model: "anthropic/claude-opus-4" } }, allowed),
    ).toThrow(OverrideModelNotAllowedError);
  });

  it("ignora overrides sin modelo (solo prompt) — el prompt no se restringe", () => {
    expect(() =>
      assertOverrideModelsAllowed({ draft: { prompt: "redacta así" } }, allowed),
    ).not.toThrow();
  });
});
