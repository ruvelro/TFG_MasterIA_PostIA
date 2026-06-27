import type { ScrubPattern } from "@/lib/pipeline/schemas";

/**
 * Patrones de limpieza activos por defecto. Eliminan meta-referencias a la investigación
 * que delatan el origen IA del texto. Cada patrón se aplica con flags `gi` (global +
 * insensible a mayúsculas y acentos alternativos).
 */
export const DEFAULT_SCRUB_PATTERNS: ScrubPattern[] = [
  { pattern: "seg[uú]n las fuentes consultadas[,.]?", replacement: "" },
  { pattern: "tras investigar[,.]?", replacement: "" },
  { pattern: "bas[aá]ndonos en los datos[,.]?", replacement: "" },
  { pattern: "de acuerdo con la investigaci[oó]n realizada[,.]?", replacement: "" },
  { pattern: "como se puede observar en las fuentes[,.]?", replacement: "" },
  { pattern: "los expertos se[nñ]alan que", replacement: "" },
  { pattern: "nuestro an[aá]lisis (indica|muestra|revela) que", replacement: "" },
];

/**
 * Etapa scrub (determinista, sin IA): aplica los patrones de expresiones regulares
 * sobre el contenido final y normaliza los espacios en blanco resultantes.
 * Recibe el Markdown del artículo y devuelve la versión limpia.
 */
export function runScrub(content: string, patterns: ScrubPattern[]): string {
  let result = content;
  for (const { pattern, replacement } of patterns) {
    result = result.replace(new RegExp(pattern, "gi"), replacement);
  }
  // Colapsar tres o más saltos de línea consecutivos en dos (un párrafo en blanco).
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
