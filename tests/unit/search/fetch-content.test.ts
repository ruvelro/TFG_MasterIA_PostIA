import { afterEach, describe, expect, it, vi } from "vitest";

import { assertSafeUrl, fetchReadableText, htmlToText } from "@/lib/search/fetch-content";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assertSafeUrl (guard anti-SSRF)", () => {
  it("permite URLs http(s) públicas", () => {
    expect(() => assertSafeUrl("https://example.com/a")).not.toThrow();
  });

  it.each([
    "http://localhost/x",
    "http://127.0.0.1/x",
    "http://10.0.0.5/x",
    "http://192.168.1.1/x",
    "http://169.254.169.254/latest/meta-data", // endpoint típico de metadatos en cloud
    "ftp://example.com",
    "file:///etc/passwd",
  ])("bloquea %s", (url) => {
    expect(() => assertSafeUrl(url)).toThrow();
  });
});

describe("htmlToText", () => {
  it("elimina etiquetas, script y style y colapsa espacios", () => {
    const html = "<style>.x{}</style><p>Hola <b>mundo</b></p><script>alert(1)</script>";
    expect(htmlToText(html)).toBe("Hola mundo");
  });
});

describe("fetchReadableText", () => {
  it("descarga y devuelve el texto legible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "<p>Contenido</p>" } as Response),
    );
    await expect(fetchReadableText("https://example.com")).resolves.toBe("Contenido");
  });

  it("lanza si la respuesta no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response));
    await expect(fetchReadableText("https://example.com")).rejects.toThrow("404");
  });

  it("no llega a hacer fetch si la URL es insegura", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchReadableText("http://localhost")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revalida el destino de una redirección y bloquea el salto a un host interno", async () => {
    // Una web pública responde 302 hacia el endpoint de metadatos de cloud: el guard debe
    // bloquear el destino en vez de seguirlo (SSRF vía redirección).
    const fetchMock = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({ location: "http://169.254.169.254/latest/meta-data" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReadableText("https://example.com")).rejects.toThrow(/internos/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la petición inicial; no sigue al destino
  });

  it("sigue una redirección hacia otra URL pública y devuelve su contenido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 301,
        headers: new Headers({ location: "https://example.org/final" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => "<p>Destino</p>",
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReadableText("https://example.com")).resolves.toBe("Destino");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
