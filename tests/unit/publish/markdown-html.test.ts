import { describe, expect, it } from "vitest";

import { markdownToHtml } from "@/lib/publish/markdown-html";

describe("markdownToHtml", () => {
  it("convierte encabezados, negritas y listas", async () => {
    const html = await markdownToHtml("## Sección\n\nTexto **clave**.\n\n- uno\n- dos");
    expect(html).toContain("<h2>Sección</h2>");
    expect(html).toContain("<strong>clave</strong>");
    expect(html).toContain("<li>uno</li>");
  });

  it("sanea HTML peligroso incrustado en el Markdown", async () => {
    const html = await markdownToHtml('Hola <script>alert(1)</script> <img src=x onerror="x">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("soporta tablas GFM", async () => {
    const html = await markdownToHtml("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
  });
});
