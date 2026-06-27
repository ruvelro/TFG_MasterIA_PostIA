import { describe, expect, it } from "vitest";

import {
  blueprintToText,
  composeEditorialVoice,
  factsToText,
  newsTypeDirectivesToText,
  reportToText,
  sourcesToText,
  styleProfileToText,
} from "@/lib/pipeline/format";
import type { NewsType, StyleProfile } from "@/lib/pipeline/schemas";

const BASE_TYPE: NewsType = {
  id: "t",
  label: "Noticia",
  description: "",
  enableHumanize: true,
  enableFactualReview: true,
  enableQualityReview: true,
  sourceStrict: false,
  structureInstruction: "",
  targetWordCount: 0,
  voiceBrand: "",
  voiceHouseRules: "",
  voiceExamples: [],
};

const EMPTY_PROFILE: StyleProfile = {
  brandVoice: "",
  houseRules: "",
  eeatAuthor: "",
  seoRules: "",
  geoRules: "",
  languageRegion: "",
  forbiddenWords: [],
  fewShotExamples: [],
};

describe("formateadores de contexto", () => {
  it("sourcesToText incluye título, url y contenido", () => {
    const text = sourcesToText([{ title: "T", url: "https://e", snippet: "s", content: "cuerpo" }]);
    expect(text).toContain("T");
    expect(text).toContain("https://e");
    expect(text).toContain("cuerpo");
  });

  it("sourcesToText indica cuando no hay fuentes", () => {
    expect(sourcesToText([])).toBe("(sin fuentes)");
  });

  it("factsToText lista cada hecho con su fuente", () => {
    const text = factsToText({
      facts: [{ claim: "La Tierra es redonda", source: "https://nasa" }],
    });
    expect(text).toContain("La Tierra es redonda");
    expect(text).toContain("https://nasa");
  });

  it("blueprintToText incluye titular y secciones", () => {
    const text = blueprintToText({
      title: "Titular",
      angle: "Ángulo",
      targetKeyword: "kw",
      sections: [{ heading: "Intro", summary: "resumen" }],
    });
    expect(text).toContain("Titular");
    expect(text).toContain("Intro");
  });

  it("reportToText resume los problemas y avisa si no hay", () => {
    expect(reportToText({ passed: true, issues: [] })).toBe("(sin problemas)");
    const text = reportToText({
      passed: false,
      issues: [
        {
          category: "ai-tone",
          severity: "high",
          description: "suena a IA",
          suggestion: "reescribe",
        },
      ],
    });
    expect(text).toContain("ai-tone");
    expect(text).toContain("reescribe");
  });

  it("styleProfileToText avisa cuando el perfil está vacío", () => {
    expect(styleProfileToText(EMPTY_PROFILE)).toBe("(sin perfil de estilo configurado)");
  });

  it("styleProfileToText incluye voz, palabras prohibidas y ejemplos; omite SEO/GEO", () => {
    const text = styleProfileToText({
      ...EMPTY_PROFILE,
      brandVoice: "Cercano y directo",
      seoRules: "NO debe aparecer aquí",
      forbiddenWords: ["en conclusión", "cabe destacar"],
      fewShotExamples: ["Un párrafo de muestra."],
    });
    expect(text).toContain("Cercano y directo");
    expect(text).toContain("en conclusión, cabe destacar");
    expect(text).toContain("Un párrafo de muestra.");
    // SEO/GEO viajan por separado, no en el render de la voz.
    expect(text).not.toContain("NO debe aparecer aquí");
  });

  it("newsTypeDirectivesToText es vacío sin tipo ni preset", () => {
    expect(newsTypeDirectivesToText(undefined)).toBe("");
  });

  it("newsTypeDirectivesToText: el preset de longitud manda sobre el targetWordCount del tipo", () => {
    const newsType: NewsType = {
      id: "t",
      label: "T",
      description: "",
      enableHumanize: true,
      enableFactualReview: true,
      enableQualityReview: true,
      sourceStrict: true,
      structureInstruction: "Nota breve",
      targetWordCount: 300,
      voiceBrand: "",
      voiceHouseRules: "",
      voiceExamples: [],
    };
    const withType = newsTypeDirectivesToText(newsType);
    expect(withType).toContain("aproximadamente 300 palabras");
    expect(withType).toContain("Nota breve");
    expect(withType).toContain("ESTRICTAMENTE");

    const withPreset = newsTypeDirectivesToText(newsType, {
      id: "extenso",
      label: "Extenso",
      minWords: 1200,
      maxWords: 1800,
    });
    expect(withPreset).toContain("entre 1200 y 1800 palabras");
    // El targetWordCount del tipo NO aparece cuando hay preset.
    expect(withPreset).not.toContain("aproximadamente 300 palabras");
  });

  describe("composeEditorialVoice", () => {
    it("devuelve la voz global tal cual cuando no hay tipo", () => {
      expect(composeEditorialVoice("VOZ GLOBAL")).toBe("VOZ GLOBAL");
    });

    it("devuelve la voz global cuando el tipo no aporta complemento", () => {
      expect(composeEditorialVoice("VOZ GLOBAL", BASE_TYPE)).toBe("VOZ GLOBAL");
    });

    it("anexa la voz del tipo SIN reemplazar la global", () => {
      const result = composeEditorialVoice("VOZ GLOBAL", {
        ...BASE_TYPE,
        voiceBrand: "Ágil y directo",
        voiceHouseRules: "Frases cortas",
        voiceExamples: ["Ejemplo de párrafo"],
      });
      expect(result).toContain("VOZ GLOBAL");
      expect(result).toContain("Ágil y directo");
      expect(result).toContain("Frases cortas");
      expect(result).toContain("Ejemplo de párrafo");
      expect(result).toContain(BASE_TYPE.label);
      // La voz global va primero (el complemento se añade después).
      expect(result.indexOf("VOZ GLOBAL")).toBeLessThan(result.indexOf("Ágil y directo"));
    });
  });
});
