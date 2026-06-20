import { describe, expect, it } from "vitest";

import { findPlaceholders, renderTemplate } from "@/lib/pipeline/render-template";

describe("renderTemplate", () => {
  it("sustituye los marcadores por los valores del contexto", () => {
    const result = renderTemplate("Escribe sobre {{topic}} usando {{sources}}.", {
      topic: "IA",
      sources: "[fuentes]",
    });
    expect(result).toBe("Escribe sobre IA usando [fuentes].");
  });

  it("admite espacios dentro de las llaves", () => {
    expect(renderTemplate("{{ topic }}", { topic: "X" })).toBe("X");
  });

  it("sustituye por cadena vacía los marcadores sin valor", () => {
    expect(renderTemplate("a{{falta}}b", {})).toBe("ab");
  });

  it("no toca el texto sin marcadores", () => {
    expect(renderTemplate("texto plano", { topic: "X" })).toBe("texto plano");
  });
});

describe("findPlaceholders", () => {
  it("devuelve los marcadores únicos de la plantilla", () => {
    expect(findPlaceholders("{{topic}} y {{sources}} y otra vez {{topic}}")).toEqual([
      "topic",
      "sources",
    ]);
  });

  it("devuelve lista vacía si no hay marcadores", () => {
    expect(findPlaceholders("sin marcadores")).toEqual([]);
  });
});
