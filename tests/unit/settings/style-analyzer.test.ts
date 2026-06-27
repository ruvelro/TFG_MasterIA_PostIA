import { describe, expect, it, vi } from "vitest";

import type { StyleAnalysisResult } from "@/lib/pipeline/schemas";
import { analyzeEditorialStyle, type AnalyzerDeps } from "@/lib/settings/style-analyzer";

const FAKE_RESULT: StyleAnalysisResult = {
  brandVoice: "Cercano",
  houseRules: "Frases cortas",
  eeatAuthor: "",
  languageRegion: "Español de España",
  forbiddenWords: ["en conclusión"],
  fewShotExamples: ["Un ejemplo."],
};

// Dependencias falsas: contenido largo para forzar el recorte y los lotes; IA determinista.
function makeDeps(overrides: Partial<AnalyzerDeps> = {}): AnalyzerDeps {
  return {
    fetchContent: async () => "a".repeat(4000),
    runText: async () => ({ text: "notas de estilo" }),
    runObject: async () => ({ object: FAKE_RESULT as never }),
    ...overrides,
  };
}

function urls(n: number): string[] {
  return Array.from({ length: n }, (_v, i) => `https://e.example/${i}`);
}

describe("analyzeEditorialStyle", () => {
  it("agrupa muchos artículos en varios lotes (map) y consolida una vez (reduce)", async () => {
    const runText = vi.fn(async () => ({ text: "notas" }));
    const runObject = vi.fn(async () => ({ object: FAKE_RESULT as never }));
    // 12 artículos × 3500 chars (recortados) > presupuesto de 40k → 2 lotes.
    const result = await analyzeEditorialStyle({
      urls: urls(12),
      model: "m",
      deps: makeDeps({ runText, runObject }),
    });

    expect(runText).toHaveBeenCalledTimes(2); // 2 lotes en el paso "map"
    expect(runObject).toHaveBeenCalledTimes(1); // 1 consolidación en el "reduce"
    expect(result.brandVoice).toBe("Cercano");
  });

  it("tolera URLs que fallan al descargar sin abortar el análisis", async () => {
    const fetchContent = vi.fn(async (url: string) => {
      if (url.endsWith("/1")) throw new Error("404");
      return "a".repeat(4000);
    });
    const result = await analyzeEditorialStyle({
      urls: urls(3),
      model: "m",
      deps: makeDeps({ fetchContent }),
    });
    expect(result).toEqual(FAKE_RESULT);
  });

  it("lanza si ninguna URL devuelve contenido", async () => {
    await expect(
      analyzeEditorialStyle({
        urls: urls(2),
        model: "m",
        deps: makeDeps({ fetchContent: async () => "" }),
      }),
    ).rejects.toThrow(/ninguna/i);
  });

  it("emite progreso de descarga, análisis y consolidación", async () => {
    const phases: string[] = [];
    await analyzeEditorialStyle({
      urls: urls(2),
      model: "m",
      deps: makeDeps(),
      onProgress: (p) => phases.push(p.phase),
    });
    expect(phases).toContain("fetch");
    expect(phases).toContain("analyze");
    expect(phases).toContain("consolidate");
  });

  it("deduplica y acota el número de URLs", async () => {
    const fetchContent = vi.fn(async () => "a".repeat(4000));
    await analyzeEditorialStyle({
      urls: ["https://e.example/x", "https://e.example/x"], // duplicada
      model: "m",
      deps: makeDeps({ fetchContent }),
    });
    expect(fetchContent).toHaveBeenCalledTimes(1); // solo una descarga
  });
});
