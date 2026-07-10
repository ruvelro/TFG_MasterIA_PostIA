import { describe, expect, it, vi } from "vitest";

import { ensureTagIds, publishToWordPress, type WordPressConfig } from "@/lib/publish/wordpress";

const config: WordPressConfig = {
  baseUrl: "https://blog.example/",
  username: "editor",
  appPassword: "abcd efgh",
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ensureTagIds", () => {
  it("crea etiquetas nuevas y reutiliza las existentes (term_exists)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { id: 11 }))
      .mockResolvedValueOnce(jsonResponse(400, { code: "term_exists", data: { term_id: 7 } }));

    const ids = await ensureTagIds(config, ["nueva", "existente"], fetchMock);
    expect(ids).toEqual([11, 7]);
    // Normaliza la URL base (barra final) y usa Basic auth.
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://blog.example/wp-json/wp/v2/tags");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("editor:abcd efgh").toString("base64")}`,
    );
  });

  it("ignora nombres vacíos y falla con un error claro ante otros rechazos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { code: "rest_forbidden" }));
    await expect(ensureTagIds(config, ["  ", "bloqueada"], fetchMock)).rejects.toThrow(
      /bloqueada.*403/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1); // el nombre vacío ni se envía
  });
});

describe("publishToWordPress", () => {
  it("publica el post con tags resueltos, extracto y JSON-LD incrustado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { id: 5 })) // tag
      .mockResolvedValueOnce(jsonResponse(201, { id: 42, link: "https://blog.example/?p=42" }));

    const result = await publishToWordPress(
      config,
      {
        title: "Titular",
        slug: "titular",
        contentHtml: "<h2>Hola</h2>",
        excerpt: "Meta",
        tags: ["ia"],
        jsonLd: { "@type": "NewsArticle" },
        status: "draft",
      },
      fetchMock,
    );

    expect(result).toEqual({ postId: 42, link: "https://blog.example/?p=42" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("https://blog.example/wp-json/wp/v2/posts");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ title: "Titular", slug: "titular", status: "draft", tags: [5] });
    // El JSON-LD viaja como <script> al final del contenido (lo genera la app, no el usuario).
    expect(body.content).toContain('<script type="application/ld+json">');
    expect(body.content).toContain('"@type":"NewsArticle"');
  });

  it("convierte un rechazo del post en un error legible", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: "Contraseña de aplicación no válida" }));
    await expect(
      publishToWordPress(
        config,
        { title: "T", slug: "t", contentHtml: "", excerpt: "", tags: [], status: "draft" },
        fetchMock,
      ),
    ).rejects.toThrow("Contraseña de aplicación no válida");
  });

  it("convierte un fallo de red en un error claro de conexión", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      publishToWordPress(
        config,
        { title: "T", slug: "t", contentHtml: "", excerpt: "", tags: [], status: "draft" },
        fetchMock,
      ),
    ).rejects.toThrow(/No se pudo conectar/);
  });
});
