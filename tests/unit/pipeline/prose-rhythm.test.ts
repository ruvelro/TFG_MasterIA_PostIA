import { describe, expect, it } from "vitest";

import { analyzeProseRhythm, proseRhythmToText } from "@/lib/pipeline/prose-rhythm";

function paragraph(words: number, seed: string): string {
  return Array.from({ length: words }, (_unused, index) => `${seed}${index}`).join(" ");
}

describe("análisis determinista del ritmo", () => {
  it("detecta una cuadrícula de párrafos casi idénticos", () => {
    const article = Array.from({ length: 10 }, (_unused, index) =>
      paragraph(50 + (index % 3), `p${index}`),
    ).join("\n\n");
    const result = analyzeProseRhythm(article);

    expect(result.paragraphCount).toBe(10);
    expect(result.artificiallyUniform).toBe(true);
    expect(result.dominantBand?.ratio).toBe(1);
    expect(proseRhythmToText(result)).toContain("Uniformidad artificial determinista: sí");
  });

  it("no penaliza una pieza breve ni un ritmo con variación orgánica", () => {
    const shortArticle = Array.from({ length: 5 }, (_unused, index) =>
      paragraph(45, `c${index}`),
    ).join("\n\n");
    const variedArticle = [18, 24, 35, 48, 62, 80, 105, 130]
      .map((words, index) => paragraph(words, `v${index}`))
      .join("\n\n");

    expect(analyzeProseRhythm(shortArticle).artificiallyUniform).toBe(false);
    expect(analyzeProseRhythm(variedArticle).artificiallyUniform).toBe(false);
  });

  it("excluye encabezados, listas y bloques de código del cálculo", () => {
    const markdown = [
      "## Encabezado",
      "",
      "- elemento de lista que no debe contar como párrafo aunque tenga bastantes palabras adicionales",
      "",
      "```ts\nconst texto = 'este bloque tampoco cuenta aunque contenga muchas palabras';\n```",
      "",
      paragraph(30, "real"),
    ].join("\n");

    expect(analyzeProseRhythm(markdown).wordCounts).toEqual([30]);
  });
});
