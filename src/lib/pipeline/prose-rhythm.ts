export interface ProseRhythmAnalysis {
  paragraphCount: number;
  wordCounts: number[];
  meanWords: number;
  coefficientOfVariation: number;
  dominantBand: {
    minWords: number;
    maxWords: number;
    paragraphCount: number;
    ratio: number;
  } | null;
  artificiallyUniform: boolean;
}

const MIN_PARAGRAPH_WORDS = 12;
const DOMINANT_BAND_WIDTH = 25;

function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:[.'’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function proseParagraphWordCounts(markdown: string): number[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  return withoutCode
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 0 &&
        !/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)/.test(block) &&
        !/^[-:|\s]+$/.test(block),
    )
    .map((block) => countWords(block.replace(/[*_`~[\]()]/g, " ")))
    .filter((words) => words >= MIN_PARAGRAPH_WORDS);
}

function findDominantBand(wordCounts: number[]): ProseRhythmAnalysis["dominantBand"] {
  if (wordCounts.length === 0) return null;
  const sorted = [...wordCounts].sort((a, b) => a - b);
  let bestStart = 0;
  let bestEnd = 0;
  let end = 0;

  for (let start = 0; start < sorted.length; start += 1) {
    while (end < sorted.length && sorted[end] - sorted[start] <= DOMINANT_BAND_WIDTH) end += 1;
    if (end - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = end;
    }
  }

  const paragraphCount = bestEnd - bestStart;
  return {
    minWords: sorted[bestStart],
    maxWords: sorted[bestEnd - 1],
    paragraphCount,
    ratio: paragraphCount / sorted.length,
  };
}

/**
 * Mide la regularidad formal sin intentar decidir el estilo mediante regex lingüísticas.
 * La señal exige suficientes párrafos y combina dispersión baja con concentración en una banda;
 * así una pieza breve o una coincidencia aislada no activa por sí sola la rehumanización.
 */
export function analyzeProseRhythm(markdown: string): ProseRhythmAnalysis {
  const wordCounts = proseParagraphWordCounts(markdown);
  const paragraphCount = wordCounts.length;
  const meanWords =
    paragraphCount > 0 ? wordCounts.reduce((total, count) => total + count, 0) / paragraphCount : 0;
  const variance =
    paragraphCount > 0
      ? wordCounts.reduce((total, count) => total + (count - meanWords) ** 2, 0) / paragraphCount
      : 0;
  const coefficientOfVariation = meanWords > 0 ? Math.sqrt(variance) / meanWords : 0;
  const dominantBand = findDominantBand(wordCounts);
  const artificiallyUniform =
    paragraphCount >= 8 && coefficientOfVariation <= 0.28 && (dominantBand?.ratio ?? 0) >= 0.75;

  return {
    paragraphCount,
    wordCounts,
    meanWords,
    coefficientOfVariation,
    dominantBand,
    artificiallyUniform,
  };
}

export function proseRhythmToText(analysis: ProseRhythmAnalysis): string {
  if (analysis.paragraphCount === 0) return "(sin suficientes párrafos de prosa para medir)";
  const band = analysis.dominantBand;
  return [
    `Párrafos evaluables: ${analysis.paragraphCount}.`,
    `Palabras por párrafo: ${analysis.wordCounts.join(", ")}.`,
    `Media: ${analysis.meanWords.toFixed(1)}; coeficiente de variación: ${analysis.coefficientOfVariation.toFixed(2)}.`,
    band
      ? `Banda dominante: ${band.paragraphCount}/${analysis.paragraphCount} párrafos entre ${band.minWords} y ${band.maxWords} palabras (${Math.round(band.ratio * 100)}%).`
      : "Banda dominante: no disponible.",
    `Uniformidad artificial determinista: ${analysis.artificiallyUniform ? "sí" : "no"}.`,
  ].join("\n");
}
