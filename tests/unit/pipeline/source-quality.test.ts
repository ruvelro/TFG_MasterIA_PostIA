import { describe, expect, it } from "vitest";

import {
  resolveResearchFreshnessDays,
  selectHighQualitySources,
} from "@/lib/pipeline/source-quality";
import type { PipelineSource } from "@/lib/pipeline/types";

function source(url: string, title: string, content: string): PipelineSource {
  return { url, title, content, snippet: title };
}

describe("calidad de fuentes de research", () => {
  it("descarta redes, snippets mínimos y referencias comunitarias si hay alternativas", () => {
    const body = "Contenido factual contrastado y suficientemente desarrollado. ".repeat(12);
    const selected = selectHighQualitySources(
      [
        source("https://facebook.com/post/1", "Publicación", body),
        source("https://breve.example/noticia", "Breve", "Sin cuerpo"),
        source("https://es.wikipedia.org/wiki/Tema", "Tema 2026", body),
        source("https://news.example/resultado", "Resultados actualizados 2026", body),
        source("https://agency.gov/press", "Comunicado oficial 2026", body),
      ],
      5,
      "Resultado del evento 2026",
      new Date("2026-07-15T00:00:00Z"),
    );

    expect(selected.map((item) => item.url)).toEqual([
      "https://agency.gov/press",
      "https://news.example/resultado",
    ]);
  });

  it("conserva la mejor fuente breve si no existe ningún cuerpo completo", () => {
    const selected = selectHighQualitySources(
      [source("https://a.example/1", "A", "breve")],
      3,
      "Tema minoritario",
    );
    expect(selected).toHaveLength(1);
  });

  it("respeta la frescura configurada y la infiere solo con señales actuales", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    expect(resolveResearchFreshnessDays("Tema histórico", 7, now)).toBe(7);
    expect(resolveResearchFreshnessDays("Balance anual 2026", 0, now)).toBe(45);
    expect(resolveResearchFreshnessDays("Historia medieval", 0, now)).toBe(0);
  });
});
