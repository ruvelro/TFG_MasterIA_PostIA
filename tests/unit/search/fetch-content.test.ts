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
});
