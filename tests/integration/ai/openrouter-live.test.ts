import { describe, expect, it } from "vitest";
import { z } from "zod";

import { runObjectGeneration, runTextGeneration } from "@/lib/ai/generate";
import { estimateCostUsd, getModelPricing } from "@/lib/ai/pricing";

/**
 * Test de integración REAL contra OpenRouter. Está APAGADO por defecto: solo se ejecuta con
 * `RUN_LIVE_AI=1` y una clave en `OPENROUTER_API_KEY`, de modo que ni CI ni `npm run test`
 * gastan tokens ni dependen de la red. Pensado para ejecución manual o en un job nightly.
 *
 *   RUN_LIVE_AI=1 OPENROUTER_API_KEY=sk-... npm run test -- openrouter-live
 *
 * Cubre lo que los e2e con dependencias falsas no ejercitan: el contrato real del proveedor
 * (parseo de `usage`, salida estructurada con Zod) y el cálculo de coste con precios reales.
 */

const LIVE = process.env.RUN_LIVE_AI === "1";
const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
// Modelo barato por defecto; se puede sobreescribir para probar otros.
const MODEL = process.env.OPENROUTER_TEST_MODEL ?? "google/gemini-2.5-flash";

// `runIf`: si no está activado, el bloque se omite (0 tests), no falla.
describe.runIf(LIVE)("OpenRouter (integración real, opt-in)", () => {
  it("requiere OPENROUTER_API_KEY cuando el live test está activado", () => {
    expect(API_KEY, "Define OPENROUTER_API_KEY para el live test").not.toBe("");
  });

  it("runTextGeneration devuelve texto y tokens de uso reales", async () => {
    const result = await runTextGeneration({
      apiKey: API_KEY,
      modelId: MODEL,
      prompt: "Responde únicamente con la palabra: PONG",
    });

    expect(result.text.length).toBeGreaterThan(0);
    // El proveedor real reporta uso de tokens; es justo lo que los fakes no ejercitan.
    expect(result.usage.inputTokens ?? 0).toBeGreaterThan(0);
    expect(result.usage.outputTokens ?? 0).toBeGreaterThan(0);
  }, 60_000);

  it("runObjectGeneration produce un objeto válido contra el esquema Zod", async () => {
    const schema = z.object({ capital: z.string() });
    const result = await runObjectGeneration({
      apiKey: API_KEY,
      modelId: MODEL,
      prompt: "Devuelve la capital de Francia en el campo 'capital'.",
      schema,
    });

    expect(result.object.capital.toLowerCase()).toContain("par");
  }, 60_000);

  it("estimateCostUsd produce un coste con el catálogo de precios real", async () => {
    const pricing = await getModelPricing();
    const cost = estimateCostUsd(pricing, MODEL, 1000, 1000);
    // El modelo debe existir en el catálogo y dar un coste finito >= 0.
    expect(cost).not.toBeNull();
    expect(cost ?? -1).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
