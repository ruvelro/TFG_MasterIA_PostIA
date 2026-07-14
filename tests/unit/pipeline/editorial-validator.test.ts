import { describe, expect, it } from "vitest";

import type { ValidatorConfig } from "@/lib/pipeline/schemas";
import {
  DEFAULT_VALIDATOR_CONFIG,
  runEditorialValidator,
} from "@/lib/pipeline/steps/editorial-validator";

const BASE: ValidatorConfig = {
  forbiddenWords: { enabled: false, severity: "error" },
  aiPatterns: { enabled: false, severity: "warning", patterns: [] },
  sourceOverlap: { enabled: false, severity: "warning", minPhraseWords: 8 },
  attributionOveruse: { enabled: false, severity: "warning", maxPerThousandWords: 6 },
};

describe("runEditorialValidator", () => {
  it("detecta una palabra prohibida y la marca con la severidad configurada", () => {
    const issues = runEditorialValidator({
      draft: "Este es un párrafo con una muletilla detestable.",
      sources: [],
      forbiddenWords: ["muletilla"],
      config: { ...BASE, forbiddenWords: { enabled: true, severity: "error" } },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe("editorial");
    expect(issues[0].severity).toBe("high"); // error → high (bloquea)
  });

  it("no marca nada si la palabra prohibida no aparece", () => {
    const issues = runEditorialValidator({
      draft: "Un texto perfectamente limpio.",
      sources: [],
      forbiddenWords: ["inexistente"],
      config: { ...BASE, forbiddenWords: { enabled: true, severity: "error" } },
    });
    expect(issues).toHaveLength(0);
  });

  it("detecta patrones de IA y mapea aviso → medium; ignora regex inválida", () => {
    const issues = runEditorialValidator({
      draft: "En conclusión, todo salió bien.",
      sources: [],
      forbiddenWords: [],
      config: {
        ...BASE,
        aiPatterns: { enabled: true, severity: "warning", patterns: ["en conclusi[oó]n", "("] },
      },
    });
    expect(issues).toHaveLength(1); // el patrón inválido "(" se ignora sin lanzar
    expect(issues[0].category).toBe("ai-tone");
    expect(issues[0].severity).toBe("medium");
  });

  it("detecta copia literal de las fuentes a partir del mínimo de palabras", () => {
    const phrase = "el mercado solar creció un cinco por ciento este año";
    const issues = runEditorialValidator({
      draft: `Según el informe, ${phrase} en toda Europa.`,
      sources: [{ content: `Datos oficiales: ${phrase}.` }],
      forbiddenWords: [],
      config: {
        ...BASE,
        sourceOverlap: { enabled: true, severity: "warning", minPhraseWords: 8 },
      },
    });
    expect(issues.some((i) => i.category === "faithfulness")).toBe(true);
  });

  it("no detecta solapamiento cuando el texto es original", () => {
    const issues = runEditorialValidator({
      draft: "Una redacción completamente distinta y original sobre el asunto.",
      sources: [{ content: "Las fuentes hablaban de otra cosa totalmente diferente." }],
      forbiddenWords: [],
      config: {
        ...BASE,
        sourceOverlap: { enabled: true, severity: "warning", minPhraseWords: 8 },
      },
    });
    expect(issues).toHaveLength(0);
  });

  it("una regla desactivada no produce hallazgos", () => {
    const issues = runEditorialValidator({
      draft: "En conclusión, contiene una muletilla.",
      sources: [],
      forbiddenWords: ["muletilla"],
      config: BASE, // todo desactivado
    });
    expect(issues).toHaveLength(0);
  });

  it("detecta exceso de atribuciones visibles", () => {
    const draft = [
      "Según ESPN, el dato abre la pieza.",
      "De acuerdo con Opta, el mercado acompaña.",
      "Ámbito informó de otra cifra relevante.",
      "El resto del texto mantiene una explicación breve.",
    ].join(" ");
    const issues = runEditorialValidator({
      draft,
      sources: [],
      forbiddenWords: [],
      config: {
        ...BASE,
        attributionOveruse: { enabled: true, severity: "warning", maxPerThousandWords: 6 },
      },
    });
    expect(issues.some((i) => i.category === "ai-tone")).toBe(true);
    expect(issues[0].description).toContain("Exceso de atribuciones");
  });

  it("la configuración por defecto trae las tres reglas activas", () => {
    expect(DEFAULT_VALIDATOR_CONFIG.forbiddenWords.enabled).toBe(true);
    expect(DEFAULT_VALIDATOR_CONFIG.aiPatterns.enabled).toBe(true);
    expect(DEFAULT_VALIDATOR_CONFIG.sourceOverlap.enabled).toBe(true);
    expect(DEFAULT_VALIDATOR_CONFIG.attributionOveruse.enabled).toBe(true);
  });
});
