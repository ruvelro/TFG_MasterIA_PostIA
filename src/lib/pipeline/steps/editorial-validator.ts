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
];

/** Configuración por defecto del validador: no bloquea de inicio salvo palabras prohibidas. */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  forbiddenWords: { enabled: true, severity: "error" },
  aiPatterns: { enabled: true, severity: "warning", patterns: DEFAULT_AI_PATTERNS },
  sourceOverlap: { enabled: true, severity: "warning", minPhraseWords: 8 },
};

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

  return issues;
}
