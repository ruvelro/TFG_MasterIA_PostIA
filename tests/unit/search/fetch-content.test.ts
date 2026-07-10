import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertSafeUrl,
  extractArticleText,
  fetchReadableText,
  htmlToText,
  isPrivateIp,
  type LookupFn,
} from "@/lib/search/fetch-content";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Resolución DNS determinista para no tocar la red en los tests. */
function lookupOf(...addresses: string[]): LookupFn {
  return async () => addresses.map((address) => ({ address }));
}

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.169.254",
    "100.64.0.1", // CGNAT (100.64.0.0/10)
    "0.0.0.0",
    "::1",
    "fc00::1", // ULA (fc00::/7)
    "fe80::1", // link-local IPv6
    "::ffff:192.168.0.1", // IPv4 privada embebida en IPv6
  ])("clasifica %s como no global", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"])(
    "clasifica %s como global",
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it("bloquea lo que no puede interpretar (fail-closed)", () => {
    expect(isPrivateIp("no-es-una-ip")).toBe(true);
  });
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
    "http://100.64.0.1/x", // CGNAT
    "http://2130706433/x", // 127.0.0.1 en notación decimal (la URL lo normaliza)
    "http://0177.0.0.1/x", // 127.0.0.1 en notación octal
    "http://[::1]/x",
    "http://[fc00::1]/x", // ULA IPv6
    "http://[fe80::1]/x", // link-local IPv6
    "http://[::ffff:10.0.0.1]/x", // IPv4 privada mapeada en IPv6
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

describe("extractArticleText (Readability)", () => {
  it("aísla el cuerpo del artículo y descarta menús y footer", () => {
    const paragraph =
      "La agencia espacial confirmó ayer el lanzamiento de la nueva misión de observación. " +
      "El cohete despegó sin incidencias y la carga útil quedó en la órbita prevista. ";
    const html = `<!doctype html><html><head><title>Noticia</title></head><body>
      <nav><ul><li>Inicio</li><li>Deportes</li><li>Economía</li></ul></nav>
      <div class="cookie-banner">Usamos cookies para mejorar tu experiencia. Aceptar.</div>
      <article><h1>Lanzamiento confirmado</h1>
        <p>${paragraph}</p><p>${paragraph}</p><p>${paragraph}</p>
      </article>
      <footer>© 2026 Portal de noticias — Aviso legal — Privacidad</footer>
    </body></html>`;

    const text = extractArticleText(html);
    expect(text).toContain("agencia espacial");
    expect(text).not.toContain("Aviso legal");
    expect(text).not.toContain("cookies");
  });

  it("cae al stripping clásico cuando no hay un artículo con entidad", () => {
    const html = "<html><body><p>Texto muy corto.</p></body></html>";
    expect(extractArticleText(html)).toBe("Texto muy corto.");
  });
});

describe("fetchReadableText", () => {
  it("descarga y devuelve el texto legible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse("<p>Contenido</p>")));
    await expect(
      fetchReadableText("https://example.com", { lookup: lookupOf("93.184.216.34") }),
    ).resolves.toBe("Contenido");
  });

  it("lanza si la respuesta no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(
      fetchReadableText("https://example.com", { lookup: lookupOf("93.184.216.34") }),
    ).rejects.toThrow("404");
  });

  it("no llega a hacer fetch si la URL es insegura", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchReadableText("http://localhost")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea un dominio público que resuelve a una IP privada", async () => {
    // No hace falta rebinding: basta un registro A estático hacia 192.168.x.x.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchReadableText("https://evil.example", { lookup: lookupOf("192.168.1.10") }),
    ).rejects.toThrow(/internos/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea si ALGUNA de las IPs resueltas es privada (multi-A)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchReadableText("https://evil.example", {
        lookup: lookupOf("93.184.216.34", "10.0.0.8"),
      }),
    ).rejects.toThrow(/internos/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza si el host no se puede resolver", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchReadableText("https://no-existe.example", {
        lookup: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    ).rejects.toThrow(/resolver/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza respuestas cuyo Content-Type no es texto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("%PDF-1.7", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      ),
    );
    await expect(
      fetchReadableText("https://example.com/doc", { lookup: lookupOf("93.184.216.34") }),
    ).rejects.toThrow(/contenido no soportado/);
  });

  it("acepta text/plain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("texto plano", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );
    await expect(
      fetchReadableText("https://example.com/robots", { lookup: lookupOf("93.184.216.34") }),
    ).resolves.toBe("texto plano");
  });

  it("trunca el cuerpo al tope de bytes y cancela la descarga (streaming)", async () => {
    // Stream infinito de chunks de 1 MB: si no se cancelara, el test no terminaría.
    const chunk = new TextEncoder().encode("a".repeat(1_000_000));
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(body, { status: 200, headers: { "content-type": "text/plain" } }),
        ),
    );

    const text = await fetchReadableText("https://example.com/enorme", {
      lookup: lookupOf("93.184.216.34"),
    });
    expect(text.length).toBeLessThanOrEqual(2_000_000);
    expect(text.length).toBeGreaterThan(0);
    expect(cancelled).toBe(true);
  });

  it("revalida el destino de una redirección y bloquea el salto a un host interno", async () => {
    // Una web pública responde 302 hacia el endpoint de metadatos de cloud: el guard debe
    // bloquear el destino en vez de seguirlo (SSRF vía redirección).
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchReadableText("https://example.com", { lookup: lookupOf("93.184.216.34") }),
    ).rejects.toThrow(/internos/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la petición inicial; no sigue al destino
  });

  it("bloquea una redirección hacia un dominio que resuelve a IP privada", async () => {
    const lookup: LookupFn = async (hostname) => [
      { address: hostname === "interna.example" ? "10.0.0.5" : "93.184.216.34" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 301,
        headers: { location: "https://interna.example/panel" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReadableText("https://example.com", { lookup })).rejects.toThrow(/internos/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sigue una redirección hacia otra URL pública y devuelve su contenido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: "https://example.org/final" } }),
      )
      .mockResolvedValueOnce(htmlResponse("<p>Destino</p>"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchReadableText("https://example.com", { lookup: lookupOf("93.184.216.34") }),
    ).resolves.toBe("Destino");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
