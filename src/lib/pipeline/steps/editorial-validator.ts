import type { ValidationIssue, ValidatorConfig } from "@/lib/pipeline/schemas";

/**
 * Validador editorial DETERMINISTA (sin IA): complementa al `validate` por IA con reglas
 * configurables y reproducibles. Detecta palabras prohibidas, patrones de redacción IA y copia
 * literal desde las fuentes. Sus hallazgos se fusionan en el informe de validación, de modo que
 * el bucle validate↔fixer ya existente los corrige (los de severidad `error` fuerzan corrección).
 */

/** Patrones de redacción IA habituales en español, activos por defecto. */
export const DEFAULT_AI_PATTERNS: string[] = [
  "en conclusi[oó]n",
  "en resumen",
  "cabe (destacar|se[nñ]alar|mencionar)",
  "es importante (destacar|se[nñ]alar|recordar)",
  "en el (mundo|panorama|contexto) actual",
  "sin lugar a dudas",
  "en la era (digital|actual)",
  "en las fuentes revisadas",
  "en los datos revisados",
  "fuentes revisadas",
  "fuentes consultadas",
  "(^|\\n)##\\s*(resumen r[aá]pido|datos clave citables|faq)\\b",
];

/** Configuración por defecto del validador: no bloquea de inicio salvo palabras prohibidas. */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  forbiddenWords: { enabled: true, severity: "error" },
  aiPatterns: { enabled: true, severity: "error", patterns: DEFAULT_AI_PATTERNS },
  sourceOverlap: { enabled: true, severity: "warning", minPhraseWords: 8 },
  attributionOveruse: { enabled: true, severity: "error", maxPerThousandWords: 2 },
};

/** Fórmulas habituales de atribución que, en exceso, delatan un texto-agregador. */
const ATTRIBUTION_PATTERNS: RegExp[] = [
  /\bseg[uú]n\b/gi,
  /\binform(?:a|[oó])\b/gi,
  /\bpublic(?:a|[oó])\b/gi,
  /\brecog(?:e|i[oó])\b/gi,
  /\bde acuerdo con\b/gi,
  /\brecogid[oa] por\b/gi,
  /\bcitad[oa] por\b/gi,
  /\bfuentes? (citadas?|consultadas?|revisadas?)\b/gi,
];

const FORBIDDEN_BODY_HEADINGS = ["resumen rápido", "resumen rapido", "datos clave citables", "faq"];

export interface EditorialValidatorInput {
  draft: string;
  /** Contenido de las fuentes para detectar copia literal. */
  sources: { content: string }[];
  /** Palabras prohibidas del perfil de estilo. */
  forbiddenWords: string[];
  config: ValidatorConfig;
}

/** Escapa una cadena para usarla literalmente dentro de una expresión regular. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** error → high (bloquea), warning → medium (informa). */
function toIssueSeverity(severity: "error" | "warning"): "high" | "medium" {
  return severity === "error" ? "high" : "medium";
}

/** Normaliza texto para comparar solapamiento: minúsculas y espacios colapsados. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Cuenta palabras con soporte básico para español; basta para calcular ratios editoriales. */
function countWords(text: string): number {
  return text.match(/\b[\wÁÉÍÓÚÜÑáéíóúüñ'-]+\b/g)?.length ?? 0;
}

function countAttributions(text: string): number {
  return ATTRIBUTION_PATTERNS.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + (text.match(pattern)?.length ?? 0);
  }, 0);
}

function stripMarkdownOpening(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("<!--"));
}

function firstContentLine(markdown: string): string | undefined {
  const lines = stripMarkdownOpening(markdown);
  let skippedTitle = false;
  for (const line of lines) {
    if (!skippedTitle && /^#\s+/.test(line)) {
      skippedTitle = true;
      continue;
    }
    if (/^\*?actualizado:/i.test(line.replace(/^\*|\*$/g, ""))) continue;
    return line;
  }
  return undefined;
}

function isListLine(line: string): boolean {
  return /^([-*+]|\d+[.)])\s+/.test(line);
}

function isForbiddenHeading(line: string): boolean {
  const normalized = line
    .replace(/^#{1,6}\s+/, "")
    .toLowerCase()
    .trim();
  return FORBIDDEN_BODY_HEADINGS.some((heading) => normalized.startsWith(heading));
}

/**
 * Ejecuta las reglas activas y devuelve los problemas encontrados, ya en el formato del informe
 * de validación. Es PURA: misma entrada, misma salida; sin red ni IA.
 */
export function runEditorialValidator(input: EditorialValidatorInput): ValidationIssue[] {
  const { draft, sources, forbiddenWords, config } = input;
  const issues: ValidationIssue[] = [];

  // 1. Palabras prohibidas del perfil de estilo.
  if (config.forbiddenWords.enabled) {
    const severity = toIssueSeverity(config.forbiddenWords.severity);
    for (const word of forbiddenWords.map((w) => w.trim()).filter(Boolean)) {
      const regex = new RegExp(escapeRegExp(word), "i");
      if (regex.test(draft)) {
        issues.push({
          category: "editorial",
          severity,
          description: `Uso de palabra prohibida: «${word}».`,
          suggestion: "Sustitúyela por una alternativa natural o elimínala.",
        });
      }
    }
  }

  // 2. Patrones de redacción IA (regex configurables; los inválidos se ignoran).
  if (config.aiPatterns.enabled) {
    const severity = toIssueSeverity(config.aiPatterns.severity);
    for (const pattern of config.aiPatterns.patterns) {
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, "i");
      } catch {
        continue;
      }
      if (regex.test(draft)) {
        issues.push({
          category: "ai-tone",
          severity,
          description: `Patrón típico de redacción IA: /${pattern}/.`,
          suggestion: "Reescribe la frase con un giro más natural y específico.",
        });
      }
    }
  }

  // 3. Copia literal desde las fuentes: fragmentos de N palabras presentes textualmente.
  if (config.sourceOverlap.enabled && sources.length > 0) {
    const severity = toIssueSeverity(config.sourceOverlap.severity);
    const sourceText = normalize(sources.map((s) => s.content).join(" "));
    const words = normalize(draft).split(" ").filter(Boolean);
    const n = config.sourceOverlap.minPhraseWords;
    const seen = new Set<string>();
    const MAX_REPORTED = 5; // no inundar el informe: basta con señalar la incidencia
    for (let i = 0; i + n <= words.length && seen.size < MAX_REPORTED; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (seen.has(phrase)) continue;
      if (sourceText.includes(phrase)) {
        seen.add(phrase);
        issues.push({
          category: "faithfulness",
          severity,
          description: `Fragmento copiado literalmente de las fuentes: «${phrase}…».`,
          suggestion: "Reformula con tus palabras para evitar la copia literal.",
        });
      }
    }
  }

  // 4. Exceso de atribuciones visibles: obliga al corrector a integrar datos con voz propia.
  if (config.attributionOveruse.enabled) {
    const attributionCount = countAttributions(draft);
    const wordCount = Math.max(countWords(draft), 1);
    const perThousand = (attributionCount / wordCount) * 1000;
    if (attributionCount > 0 && perThousand > config.attributionOveruse.maxPerThousandWords) {
      issues.push({
        category: "ai-tone",
        severity: toIssueSeverity(config.attributionOveruse.severity),
        description: `Exceso de atribuciones visibles: ${attributionCount} en ${wordCount} palabras.`,
        suggestion:
          "Integra los datos con voz editorial propia y deja atribución explícita solo para datos discutibles, citas, cuotas o predicciones.",
      });
    }
  }

  // 5. Forma periodística mínima: la pieza no debe abrir con lista ni bloques de plantilla.
  const first = firstContentLine(draft);
  if (first && (isListLine(first) || isForbiddenHeading(first))) {
    issues.push({
      category: "ai-tone",
      severity: "high",
      description: `Arranque no periodístico: «${first}».`,
      suggestion:
        "Sustituye el bloque inicial por una entradilla en prosa y elimina listas, tablas o resúmenes rápidos al comienzo.",
    });
  }

  const headings = stripMarkdownOpening(draft).filter((line) => /^#{2,6}\s+/.test(line));
  for (const heading of headings) {
    if (!isForbiddenHeading(heading)) continue;
    issues.push({
      category: "ai-tone",
      severity: "high",
      description: `Sección con formato de plantilla: «${heading}».`,
      suggestion:
        "Elimina esa sección del cuerpo del artículo o integra la información útil en párrafos periodísticos.",
    });
  }

  return issues;
}
