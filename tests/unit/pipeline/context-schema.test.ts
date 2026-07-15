import { describe, expect, it } from "vitest";

import { parsePipelineContext } from "@/lib/pipeline/context-schema";
import type { PipelineContext } from "@/lib/pipeline/types";

// Contexto mínimo válido tal y como lo serializa el orquestador tras la extracción.
const validContext: PipelineContext = {
  topic: "Energía solar",
  sources: [
    { title: "Fuente", url: "https://e.example/0", snippet: "extracto", content: "cuerpo" },
  ],
  facts: { facts: [{ claim: "Un hecho", source: "https://e.example/0" }] },
};

describe("parsePipelineContext", () => {
  it("acepta un contexto válido y lo devuelve tipado", () => {
    const parsed = parsePipelineContext(JSON.stringify(validContext));
    expect(parsed.topic).toBe("Energía solar");
    expect(parsed.facts?.facts[0].claim).toBe("Un hecho");
  });

  it("rellena el contenido vacío de fuentes sin cuerpo descargado", () => {
    const ctx = { topic: "t", sources: [{ title: "T", url: "https://e/0", snippet: "s" }] };
    const parsed = parsePipelineContext(JSON.stringify(ctx));
    expect(parsed.sources[0].content).toBe("");
  });

  it("rehidrata blueprints antiguos con los nuevos campos editoriales", () => {
    const ctx = {
      topic: "t",
      sources: [],
      blueprint: {
        title: "T",
        angle: "Ángulo heredado",
        targetKeyword: "kw",
        sections: [{ heading: "H", summary: "S" }],
      },
    };
    const parsed = parsePipelineContext(JSON.stringify(ctx));
    expect(parsed.blueprint?.readerPromise).toBe("Ángulo heredado");
    expect(parsed.blueprint?.excludeOrCompress).toEqual([]);
  });

  it("rehidrata quality reviews anteriores a las categorías de incidencias", () => {
    const ctx = {
      topic: "t",
      sources: [],
      qualityReport: {
        structureScore: 80,
        factualSupportScore: 80,
        seoScore: 80,
        wordCount: 700,
        aiScore: 30,
        issues: [{ description: "Incidencia heredada", suggestion: "Corregir" }],
        suggestions: [],
      },
    };
    const parsed = parsePipelineContext(JSON.stringify(ctx));
    expect(parsed.qualityReport?.issues[0].category).toBe("structure");
  });

  it("rehidrata revisiones factuales anteriores al grado de evidencia", () => {
    const ctx = {
      topic: "t",
      sources: [],
      factualReport: {
        riskLevel: "medium",
        claims: [{ claim: "Dato antiguo", status: "doubtful", reason: "No consta" }],
        summary: "Revisión heredada",
        researchSufficiency: { sufficient: true, reason: "Suficiente" },
      },
    };
    const parsed = parsePipelineContext(JSON.stringify(ctx));
    expect(parsed.factualReport?.claims[0]).toMatchObject({
      evidenceType: "unsupported",
      sourceAuthority: "unknown",
    });
  });

  it("lanza un error claro si el JSON está corrupto", () => {
    expect(() => parsePipelineContext("{no es json")).toThrow(/corrupto/i);
  });

  it("lanza un error claro si falta un campo obligatorio", () => {
    // Sin `topic` (obligatorio) ni `sources`: simula un contexto de una versión incompatible.
    expect(() => parsePipelineContext(JSON.stringify({ facts: { facts: [] } }))).toThrow(
      /inválido o de una versión incompatible/i,
    );
  });

  it("rechaza un campo con forma equivocada", () => {
    const bad = { topic: "t", sources: [], facts: { facts: "no es un array" } };
    expect(() => parsePipelineContext(JSON.stringify(bad))).toThrow();
  });
});
