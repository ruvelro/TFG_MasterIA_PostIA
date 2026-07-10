/**
 * Métricas DETERMINISTAS del harness (sin IA): complementan al juez LLM con medidas
 * reproducibles del texto. Misma entrada, misma salida — sirven de contraste barato y
 * estable entre configuraciones.
 */

export interface DeterministicMetrics {
  wordCount: number;
  headingCount: number;
  paragraphCount: number;
  /** Desviación típica de la longitud (en palabras) de los párrafos: la uniformidad delata IA. */
  paragraphLengthStdDev: number;
  /** Longitud media de frase en palabras. */
  avgSentenceLength: number;
  /** La keyword objetivo aparece en el primer párrafo (regla SEO clásica). */
  keywordInFirstParagraph: boolean;
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function computeDeterministicMetrics(
  markdown: string,
  targetKeyword?: string,
): DeterministicMetrics {
  const lines = markdown.split("\n");
  const headingCount = lines.filter((line) => /^#{1,6}\s/.test(line)).length;

  // Párrafos: bloques no vacíos que no son encabezados.
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !/^#{1,6}\s/.test(block));

  const paragraphLengths = paragraphs.map((paragraph) => words(paragraph).length);
  const mean =
    paragraphLengths.length > 0
      ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
      : 0;
  const variance =
    paragraphLengths.length > 0
      ? paragraphLengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / paragraphLengths.length
      : 0;

  const plainText = markdown
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plainText.split(/[.!?]+\s/).filter((sentence) => words(sentence).length > 0);
  const totalWords = words(plainText).length;

  const firstParagraph = paragraphs[0] ?? "";
  const keywordInFirstParagraph = targetKeyword
    ? firstParagraph.toLowerCase().includes(targetKeyword.toLowerCase())
    : false;

  return {
    wordCount: totalWords,
    headingCount,
    paragraphCount: paragraphs.length,
    paragraphLengthStdDev: Math.sqrt(variance),
    avgSentenceLength: sentences.length > 0 ? totalWords / sentences.length : 0,
    keywordInFirstParagraph,
  };
}
