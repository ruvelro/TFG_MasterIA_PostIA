import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  createOpenRouterModel: vi.fn(() => "model"),
}));

vi.mock("ai", () => ({
  generateObject: mocks.generateObject,
  generateText: mocks.generateText,
  NoObjectGeneratedError: {
    isInstance: (error: unknown) =>
      error instanceof Error && error.name === "AI_NoObjectGeneratedError",
  },
}));

vi.mock("@/lib/ai/openrouter", () => ({
  createOpenRouterModel: mocks.createOpenRouterModel,
}));

import { runObjectGeneration, runTextGeneration } from "@/lib/ai/generate";

const schema = z.object({ score: z.number(), issues: z.array(z.string()) });

function noObjectError(text: string): Error & {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
} {
  return Object.assign(new Error("No object generated: could not parse the response."), {
    name: "AI_NoObjectGeneratedError",
    text,
    usage: { inputTokens: 10, outputTokens: 5 },
  });
}

describe("runObjectGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenera con el esquema y valida cada respuesta cuando el SDK no puede parsear", async () => {
    mocks.generateObject.mockRejectedValue(noObjectError("respuesta no estructurada"));
    mocks.generateText
      .mockResolvedValueOnce({
        text: '{"score":"alto","issues":[]}',
        usage: { inputTokens: 20, outputTokens: 8 },
      })
      .mockResolvedValueOnce({
        text: '```json\n{"score":82,"issues":[]}\n```',
        usage: { inputTokens: 21, outputTokens: 9 },
      });

    await expect(
      runObjectGeneration({
        apiKey: "test-key",
        modelId: "openai/test",
        prompt: "Evalúa el texto",
        schema,
      }),
    ).resolves.toEqual({
      object: { score: 82, issues: [] },
      usage: { inputTokens: 21, outputTokens: 9 },
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 16_384,
    });
    expect(mocks.generateText.mock.calls[0]?.[0].prompt).toContain('"score"');
    expect(mocks.generateText.mock.calls[1]?.[0].prompt).toContain("intento 2");
  });

  it("recupera localmente un objeto válido envuelto en Markdown sin otra llamada", async () => {
    mocks.generateObject.mockRejectedValue(
      noObjectError('Resultado:\n```json\n{"score":91,"issues":[]}\n```'),
    );

    await expect(
      runObjectGeneration({
        apiKey: "test-key",
        modelId: "openai/test",
        prompt: "Evalúa el texto",
        schema,
      }),
    ).resolves.toMatchObject({ object: { score: 91, issues: [] } });

    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe("runTextGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("limita los tokens de salida para evitar reservas enormes del proveedor", async () => {
    mocks.generateText.mockResolvedValue({
      text: "texto humanizado",
      usage: { inputTokens: 12, outputTokens: 4 },
    });

    await expect(
      runTextGeneration({
        apiKey: "test-key",
        modelId: "openai/test",
        prompt: "Humaniza este borrador",
      }),
    ).resolves.toEqual({
      text: "texto humanizado",
      usage: { inputTokens: 12, outputTokens: 4 },
    });

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 16_384 }),
    );
  });

  it("permite sobreescribir el límite de salida cuando una llamada lo necesita", async () => {
    mocks.generateText.mockResolvedValue({ text: "ok", usage: {} });

    await runTextGeneration({
      apiKey: "test-key",
      modelId: "openai/test",
      prompt: "Resumen corto",
      maxOutputTokens: 512,
    });

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 512 }),
    );
  });
});
