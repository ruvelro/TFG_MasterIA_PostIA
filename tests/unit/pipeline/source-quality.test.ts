import { describe, expect, it } from "vitest";

import {
  resolveResearchFreshnessDays,
  selectHighQualitySources,
} from "@/lib/pipeline/source-quality";
import type { PipelineSource } from "@/lib/pipeline/types";

function source(url: string, title: string, content: string, snippet = title): PipelineSource {
  return { url, title, content, snippet };
}

describe("calidad de fuentes de research", () => {
  it("descarta redes, snippets mínimos y referencias comunitarias si hay alternativas", () => {
    const body = "Contenido factual contrastado y suficientemente desarrollado. ".repeat(12);
    const selected = selectHighQualitySources(
      [
        source("https://facebook.com/post/1", "Publicación", body),
        source("https://breve.example/noticia", "Breve", "Sin cuerpo"),
        source("https://es.wikipedia.org/wiki/Tema", "Tema 2026", body),
        source("https://news.example/resultado", "Resultados actualizados 2026", `${body} medio`),
        source("https://agency.gov/press", "Comunicado oficial 2026", `${body} organismo`),
        source("https://tips.example/sports-betting/evento", "Apuestas del evento 2026", body),
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
      [source("https://a.example/1", "Tema minoritario", "breve")],
      3,
      "Tema minoritario",
    );
    expect(selected).toHaveLength(1);
  });

  it("rechaza títulos ajenos al tema y deduplica cuerpos idénticos", () => {
    const body = "España jugará la final del Mundial 2026 tras superar la semifinal. ".repeat(8);
    const relevantSnippet = "España jugará la final del Mundial 2026";
    const selected = selectHighQualitySources(
      [
        source(
          "https://espn.example/watch/baseball",
          "Richie Palacios crushes a home run",
          body,
          relevantSnippet,
        ),
        source("https://uno.example/final", "España alcanza la final del Mundial 2026", body),
        source(
          "https://agency.gov/press",
          "Comunicado oficial: España, en la final del Mundial 2026",
          body,
        ),
      ],
      5,
      "Previsión España final Mundial 2026",
      new Date("2026-07-15T00:00:00Z"),
    );

    expect(selected.map((item) => item.url)).toEqual(["https://agency.gov/press"]);
  });

  it("exige el identificador exacto de versión en metadatos y cuerpo", () => {
    const selected = selectHighQualitySources(
      [
        source(
          "https://learn.example/windows-25h2",
          "Windows 11 25H2: estado y soporte",
          "Documentación extensa sobre Windows 11 25H2. ".repeat(12),
        ),
        source(
          "https://learn.example/windows-26h2",
          "Windows 11 26H2: canal experimental",
          "Documentación oficial sobre Windows 11 26H2 y su paquete de habilitación. ".repeat(10),
        ),
        source(
          "https://copy.example/windows-26h2",
          "Windows 11 26H2: novedades",
          "Página genérica sobre Windows sin mencionar la versión dentro del artículo. ".repeat(10),
        ),
      ],
      5,
      "Todas las novedades de Windows 11 26H2",
    );

    expect(selected.map((item) => item.url)).toEqual(["https://learn.example/windows-26h2"]);
  });

  it("respeta la frescura configurada y la infiere solo con señales actuales", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    expect(resolveResearchFreshnessDays("Tema histórico", 7, now)).toBe(7);
    expect(resolveResearchFreshnessDays("Balance anual 2026", 0, now)).toBe(45);
    expect(resolveResearchFreshnessDays("Novedades de Windows 11 26H2", 0, now)).toBe(45);
    expect(resolveResearchFreshnessDays("Historia medieval", 0, now)).toBe(0);
  });
});
