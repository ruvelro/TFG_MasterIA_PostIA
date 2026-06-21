import { describe, expect, it } from "vitest";

import { blueprintToText, factsToText, reportToText, sourcesToText } from "@/lib/pipeline/format";

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
});
