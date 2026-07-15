import { describe, expect, it } from "vitest";

import { extractUserContextUrls } from "@/lib/pipeline/user-context";

describe("extractUserContextUrls", () => {
  it("extrae, normaliza y deduplica URLs sin arrastrar puntuación", () => {
    expect(
      extractUserContextUrls(
        "Usa https://example.com/doc#datos, y contrasta https://example.com/doc#otra. También https://otro.es/a).",
      ),
    ).toEqual(["https://example.com/doc", "https://otro.es/a"]);
  });

  it("ignora fragmentos inválidos y protocolos no web", () => {
    expect(extractUserContextUrls("ftp://example.com https:// inválida")).toEqual([]);
  });
});
