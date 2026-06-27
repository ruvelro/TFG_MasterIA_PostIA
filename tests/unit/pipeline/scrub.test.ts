import { describe, expect, it } from "vitest";

import { DEFAULT_SCRUB_PATTERNS, runScrub } from "@/lib/pipeline/steps/scrub";

describe("runScrub", () => {
  it("elimina las meta-referencias de investigación por defecto", () => {
    const input = "El mercado creció. Según las fuentes consultadas, el alza fue del 5%.";
    const output = runScrub(input, DEFAULT_SCRUB_PATTERNS);
    expect(output).not.toMatch(/seg[uú]n las fuentes consultadas/i);
    expect(output).toContain("el alza fue del 5%");
  });

  it("conserva el texto que no coincide con ningún patrón", () => {
    const input = "Un párrafo totalmente normal sin muletillas.";
    expect(runScrub(input, DEFAULT_SCRUB_PATTERNS)).toBe(input);
  });

  it("normaliza espacios huérfanos y puntuación descolgada tras un borrado", () => {
    // Al borrar "los expertos señalan que " queda un espacio doble antes de "el".
    const input = "Hoy los expertos señalan que el precio sube .";
    const output = runScrub(input, [{ pattern: "los expertos se[nñ]alan que", replacement: "" }]);
    expect(output).not.toMatch(/ {2,}/);
    expect(output).not.toMatch(/ \./); // sin espacio antes del punto
  });

  it("ignora un patrón con sintaxis de regex inválida sin lanzar", () => {
    const input = "Texto intacto.";
    // "(" sin cerrar es una regex inválida: debe descartarse, no romper la generación.
    expect(() => runScrub(input, [{ pattern: "(", replacement: "" }])).not.toThrow();
    expect(runScrub(input, [{ pattern: "(", replacement: "" }])).toBe(input);
  });

  it("colapsa tres o más saltos de línea en un único párrafo en blanco", () => {
    const input = "Primer párrafo.\n\n\n\nSegundo párrafo.";
    expect(runScrub(input, [])).toBe("Primer párrafo.\n\nSegundo párrafo.");
  });
});
