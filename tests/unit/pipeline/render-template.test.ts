import { describe, expect, it } from "vitest";

import {
  appendEditorialVoice,
  appendUserContext,
  findPlaceholders,
  renderTemplate,
} from "@/lib/pipeline/render-template";

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

describe("contratos obligatorios de prompt", () => {
  it("anexa el contexto y su prioridad cuando una plantilla personalizada omite el marcador", () => {
    const result = appendUserContext("Prompt", "Prompt", "Dato exclusivo del usuario");

    expect(result).toContain("CONTRATO DE CONTEXTO DEL USUARIO (OBLIGATORIO)");
    expect(result).toContain("Dato exclusivo del usuario");
    expect(result).toContain("prioridad factual máxima");
  });

  it("refuerza la prioridad sin duplicar el contexto cuando la plantilla sí usa el marcador", () => {
    const template = "Contexto: {{context}}";
    const prompt = renderTemplate(template, { context: "Dato único" });
    const result = appendUserContext(prompt, template, "Dato único");

    expect(result.match(/Dato único/g)).toHaveLength(1);
    expect(result).toContain("CONTRATO DE CONTEXTO DEL USUARIO (OBLIGATORIO)");
  });

  it("anexa la voz si una plantilla personalizada omite editorialVoice", () => {
    const result = appendEditorialVoice("Prompt", "Prompt", "Tono directo y sobrio");

    expect(result).toContain("CONTRATO DE VOZ EDITORIAL (OBLIGATORIO)");
    expect(result).toContain("Tono directo y sobrio");
  });
});
