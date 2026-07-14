import { describe, expect, it } from "vitest";

import {
  composeMarkdownDocument,
  stripLeadingMarkdownTitle,
} from "@/lib/publish/markdown-document";

describe("documento Markdown publicable", () => {
  it("añade el título de metadata como único H1", () => {
    expect(composeMarkdownDocument("Titular final", "Entradilla.\n\n## Sección")).toBe(
      "# Titular final\n\nEntradilla.\n\n## Sección\n",
    );
  });

  it("sustituye un H1 heredado y normaliza saltos del título", () => {
    expect(composeMarkdownDocument("# Titular\nfinal", "# Título viejo\n\nEntradilla.")).toBe(
      "# Titular final\n\nEntradilla.\n",
    );
  });

  it("retira solo el H1 inicial y conserva los encabezados de sección", () => {
    expect(stripLeadingMarkdownTitle("\n# Título\n\n## Sección\nTexto")).toBe("## Sección\nTexto");
    expect(stripLeadingMarkdownTitle("## Sección\nTexto")).toBe("## Sección\nTexto");
  });
});
