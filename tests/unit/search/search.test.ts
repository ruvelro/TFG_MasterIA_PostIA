import { afterEach, describe, expect, it, vi } from "vitest";

import { createSearchProvider } from "@/lib/search";
import { GoogleCseProvider } from "@/lib/search/google-cse";
import { TavilyProvider } from "@/lib/search/tavily";

function mockFetchJson(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TavilyProvider", () => {
  it("normaliza la respuesta de Tavily a SearchResult[]", async () => {
    const fetchMock = mockFetchJson({
      results: [{ title: "T1", url: "https://a.example", content: "extracto" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await new TavilyProvider("clave").search("ia", 3);

    expect(results).toEqual([{ title: "T1", url: "https://a.example", snippet: "extracto" }]);
    // Envía la clave por cabecera Authorization y el límite en el cuerpo.
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer clave");
    expect(JSON.parse(init.body)).toMatchObject({ query: "ia", max_results: 3 });
  });

  it("lanza si la respuesta no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    await expect(new TavilyProvider("clave").search("x")).rejects.toThrow("401");
  });

  it("traduce la frescura al parámetro days con topic news", async () => {
    const fetchMock = mockFetchJson({ results: [] });
    vi.stubGlobal("fetch", fetchMock);

    await new TavilyProvider("clave").search("ia", 3, { freshnessDays: 7 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ topic: "news", days: 7 });

    // Sin frescura no se envían los parámetros (búsqueda general, no de noticias).
    await new TavilyProvider("clave").search("ia", 3);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).not.toHaveProperty("days");
    expect(body).not.toHaveProperty("topic");
  });
});

describe("GoogleCseProvider", () => {
  it("normaliza la respuesta de Google CSE a SearchResult[]", async () => {
    const fetchMock = mockFetchJson({
      items: [{ title: "G1", link: "https://b.example", snippet: "fragmento" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await new GoogleCseProvider("k", "cx").search("ia", 5);

    expect(results).toEqual([{ title: "G1", url: "https://b.example", snippet: "fragmento" }]);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("key=k");
    expect(calledUrl).toContain("cx=cx");
    expect(calledUrl).toContain("q=ia");
  });

  it("traduce la frescura al parámetro dateRestrict", async () => {
    const fetchMock = mockFetchJson({ items: [] });
    vi.stubGlobal("fetch", fetchMock);

    await new GoogleCseProvider("k", "cx").search("ia", 5, { freshnessDays: 30 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("dateRestrict=d30");

    await new GoogleCseProvider("k", "cx").search("ia", 5);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("dateRestrict");
  });
});

describe("createSearchProvider", () => {
  it("crea el proveedor Tavily cuando está configurado", () => {
    const provider = createSearchProvider({ provider: "tavily", tavilyApiKey: "k" });
    expect(provider).toBeInstanceOf(TavilyProvider);
  });

  it("crea el proveedor Google cuando está configurado", () => {
    const provider = createSearchProvider({
      provider: "google",
      googleApiKey: "k",
      googleEngineId: "cx",
    });
    expect(provider).toBeInstanceOf(GoogleCseProvider);
  });

  it("falla con un mensaje claro si faltan credenciales", () => {
    expect(() => createSearchProvider({ provider: "tavily" })).toThrow("Tavily");
    expect(() => createSearchProvider({ provider: "google", googleApiKey: "k" })).toThrow(
      "Google CSE",
    );
  });
});
