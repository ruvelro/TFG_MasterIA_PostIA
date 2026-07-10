import { describe, expect, it } from "vitest";

import { computeDeterministicMetrics } from "@/lib/eval/metrics";

const ARTICLE = [
  "# Titular del artículo",
  "",
  "La energía solar creció un 20 % el año pasado. Es un dato relevante para el sector.",
  "",
  "## Primera sección",
  "",
  "Un párrafo corto.",
  "",
  "## Segunda sección",
  "",
  "Este párrafo es bastante más largo que el anterior porque desarrolla la idea con detalle y matices.",
].join("\n");

describe("computeDeterministicMetrics", () => {
  it("cuenta palabras, encabezados y párrafos", () => {
    const metrics = computeDeterministicMetrics(ARTICLE);
    expect(metrics.headingCount).toBe(3);
    expect(metrics.paragraphCount).toBe(3);
    expect(metrics.wordCount).toBeGreaterThan(20);
  });

  it("detecta la keyword en el primer párrafo (sin distinguir mayúsculas)", () => {
    expect(computeDeterministicMetrics(ARTICLE, "Energía Solar").keywordInFirstParagraph).toBe(
      true,
    );
    expect(computeDeterministicMetrics(ARTICLE, "criptomonedas").keywordInFirstParagraph).toBe(
      false,
    );
  });

  it("la desviación de longitud de párrafos es 0 cuando todos miden lo mismo", () => {
    const uniform = "Uno dos tres.\n\nUno dos tres.\n\nUno dos tres.";
    expect(computeDeterministicMetrics(uniform).paragraphLengthStdDev).toBe(0);
  });

  it("no revienta con un texto vacío", () => {
    const metrics = computeDeterministicMetrics("");
    expect(metrics.wordCount).toBe(0);
    expect(metrics.paragraphCount).toBe(0);
    expect(metrics.avgSentenceLength).toBe(0);
  });
});
