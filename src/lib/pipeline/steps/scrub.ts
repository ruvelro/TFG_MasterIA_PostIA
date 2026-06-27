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
 *
 * Robusto frente a configuración: un patrón con sintaxis de regex inválida (que un admin
 * podría introducir por error) se ignora en vez de tumbar toda la generación.
 */
export function runScrub(content: string, patterns: ScrubPattern[]): string {
  let result = content;
  for (const { pattern, replacement } of patterns) {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "gi");
    } catch {
      // Patrón inválido: se descarta sin interrumpir la limpieza ni la generación.
      continue;
    }
    result = result.replace(regex, replacement);
  }
  // Normaliza los restos de los borrados: espacios huérfanos, puntuación descolgada y
  // saltos de línea sobrantes que quedan al eliminar muletillas a mitad de frase.
  return result
    .replace(/[ \t]{2,}/g, " ") // colapsa espacios múltiples en uno
    .replace(/[ \t]+([,.;:])/g, "$1") // elimina el espacio previo a un signo de puntuación
    .replace(/[ \t]+\n/g, "\n") // elimina espacios al final de línea
    .replace(/\n{3,}/g, "\n\n") // colapsa saltos de línea (un párrafo en blanco como máximo)
    .trim();
}
