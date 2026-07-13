import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El módulo cachea a nivel de proceso. Para aislar cada test se recarga el módulo (reset del
 * registro) y se restaura el `fetch` global entre casos.
 */
async function freshModule() {
  vi.resetModules();
  return (await import("@/lib/ai/openrouter-models")).getOpenRouterModels;
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("getOpenRouterModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normaliza id y name, y ordena por id", async () => {
    const load = await freshModule();
    mockFetchOnce({
      data: [
        { id: "openai/gpt-5", name: "OpenAI: GPT-5" },
        { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash" },
      ],
    });

    const models = await load();

    expect(models).toEqual([
      { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash" },
      { id: "openai/gpt-5", name: "OpenAI: GPT-5" },
    ]);
  });

  it("descarta entradas sin id válido y usa el id como name si falta", async () => {
    const load = await freshModule();
    mockFetchOnce({
      data: [
        { id: "", name: "sin id" },
        { name: "sin id tampoco" },
        { id: "x/y" }, // sin name → name = id
      ],
    });

    const models = await load();

    expect(models).toEqual([{ id: "x/y", name: "x/y" }]);
  });

  it("cachea: una segunda llamada no vuelve a salir a la red", async () => {
    const load = await freshModule();
    const fetchMock = mockFetchOnce({ data: [{ id: "a/b", name: "A B" }] });

    await load();
    await load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ante un fallo de red devuelve lista vacía sin lanzar", async () => {
    const load = await freshModule();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(load()).resolves.toEqual([]);
  });

  it("no cachea una respuesta vacía (permite recuperarse en la siguiente llamada)", async () => {
    const load = await freshModule();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: "a/b", name: "A B" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    expect(await load()).toEqual([]);
    expect(await load()).toEqual([{ id: "a/b", name: "A B" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
