import { describe, expect, it } from "vitest";

import { aggregateEvalRecords, renderMarkdownReport } from "@/lib/eval/report";
import type { EvalRecord } from "@/lib/eval/runner";

function record(overrides: Partial<EvalRecord>): EvalRecord {
  return {
    rubricVersion: 1,
    timestamp: "2026-07-10T00:00:00.000Z",
    topicId: "t",
    topic: "Tema",
    configId: "base",
    mode: "pipeline",
    status: "completed",
    latencyMs: 10_000,
    costUsd: 0.01,
    tokensInput: 100,
    tokensOutput: 200,
    ...overrides,
  };
}

const judge = {
  faithfulness: 80,
  structure: 70,
  style: 60,
  seo: 75,
  overall: 72,
  rationale: "ok",
};

describe("aggregateEvalRecords", () => {
  it("agrega medias por configuración y separa los errores", () => {
    const aggregates = aggregateEvalRecords([
      record({ judge, validationPassed: true, costUsd: 0.02, latencyMs: 20_000 }),
      record({ judge: { ...judge, overall: 52 }, validationPassed: false, costUsd: 0.04 }),
      record({ status: "error", error: "boom", costUsd: null }),
      record({ configId: "llamada-unica", mode: "single-call", judge, costUsd: 0.005 }),
    ]);

    const base = aggregates.find((a) => a.configId === "base");
    expect(base?.cases).toBe(3);
    expect(base?.errors).toBe(1);
    expect(base?.avgJudgeOverall).toBeCloseTo(62, 5); // (72+52)/2
    expect(base?.avgCostUsd).toBeCloseTo(0.03, 5);
    expect(base?.validationPassRate).toBeCloseTo(0.5, 5);

    // La línea base no tiene validación del pipeline: la tasa no aplica.
    const single = aggregates.find((a) => a.configId === "llamada-unica");
    expect(single?.validationPassRate).toBeNull();
    expect(single?.avgCostUsd).toBeCloseTo(0.005, 5);
  });

  it("renderiza una tabla Markdown con una fila por configuración", () => {
    const table = renderMarkdownReport(
      aggregateEvalRecords([record({ judge }), record({ configId: "economico", judge })]),
    );
    expect(table).toContain("| base |");
    expect(table).toContain("| economico |");
    expect(table.split("\n")).toHaveLength(4); // cabecera + separador + 2 filas
  });
});
