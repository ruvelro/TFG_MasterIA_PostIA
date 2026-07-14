import { describe, expect, it } from "vitest";

import { buildAbortSignal, repairStructuredObjectText } from "@/lib/ai/generate";

describe("buildAbortSignal", () => {
  it("sin señal de usuario devuelve una señal viva (solo timeout)", () => {
    const signal = buildAbortSignal();
    expect(signal.aborted).toBe(false);
  });

  it("propaga una cancelación de usuario YA abortada", () => {
    // Si el cliente ya canceló antes de la llamada, la señal compuesta nace abortada y el
    // AI SDK no llega a lanzar la petición.
    const signal = buildAbortSignal(AbortSignal.abort());
    expect(signal.aborted).toBe(true);
  });

  it("se aborta cuando la señal de usuario se cancela después", () => {
    const controller = new AbortController();
    const signal = buildAbortSignal(controller.signal);
    expect(signal.aborted).toBe(false);

    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("se aborta al agotarse el timeout configurado", async () => {
    // Timeout muy corto para no ralentizar el test: la señal debe abortarse sola sin que el
    // usuario cancele. Verifica que el parámetro de timeout se respeta.
    const signal = buildAbortSignal(undefined, 5);
    expect(signal.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(signal.aborted).toBe(true);
  });
});

describe("repairStructuredObjectText", () => {
  it("extrae JSON válido envuelto en una cerca Markdown", async () => {
    await expect(
      repairStructuredObjectText({
        text: ["Aquí tienes:", "```json", '{"capital":"París"}', "```"].join("\n"),
      }),
    ).resolves.toBe('{"capital":"París"}');
  });

  it("extrae el primer objeto JSON aunque haya texto antes y después", async () => {
    await expect(
      repairStructuredObjectText({
        text: 'Respuesta: {"title":"Uno","sections":[{"heading":"A","summary":"B"}]} Gracias.',
      }),
    ).resolves.toBe('{"title":"Uno","sections":[{"heading":"A","summary":"B"}]}');
  });

  it("respeta llaves dentro de strings JSON", async () => {
    await expect(
      repairStructuredObjectText({
        text: '```json\n{"summary":"Dato con } dentro del texto","items":["{literal}"]}\n```',
      }),
    ).resolves.toBe('{"summary":"Dato con } dentro del texto","items":["{literal}"]}');
  });

  it("devuelve null si no hay JSON reparable", async () => {
    await expect(
      repairStructuredObjectText({ text: "No puedo generar esa estructura." }),
    ).resolves.toBe(null);
  });
});
