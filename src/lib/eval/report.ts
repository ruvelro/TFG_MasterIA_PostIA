import type { EvalRecord } from "./runner";

/**
 * Agregación de los registros del harness por configuración. Separado del CLI para poder
 * testear la aritmética (medias, tasas) sin tocar el sistema de ficheros.
 */

export interface ConfigAggregate {
  configId: string;
  cases: number;
  errors: number;
  /** Medias sobre los casos completados. */
  avgJudgeOverall: number | null;
  avgJudgeFaithfulness: number | null;
  avgJudgeStyle: number | null;
  avgCostUsd: number | null;
  avgLatencyMs: number | null;
  avgWordCount: number | null;
  /** Tasa de casos con validación superada (solo modo pipeline; null si no aplica). */
  validationPassRate: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function aggregateEvalRecords(records: EvalRecord[]): ConfigAggregate[] {
  const byConfig = new Map<string, EvalRecord[]>();
  for (const record of records) {
    const list = byConfig.get(record.configId) ?? [];
    list.push(record);
    byConfig.set(record.configId, list);
  }

  return [...byConfig.entries()].map(([configId, list]) => {
    const completed = list.filter((r) => r.status === "completed");
    const withValidation = completed.filter((r) => r.validationPassed !== undefined);
    return {
      configId,
      cases: list.length,
      errors: list.length - completed.length,
      avgJudgeOverall: mean(
        completed.map((r) => r.judge?.overall).filter((v): v is number => v != null),
      ),
      avgJudgeFaithfulness: mean(
        completed.map((r) => r.judge?.faithfulness).filter((v): v is number => v != null),
      ),
      avgJudgeStyle: mean(
        completed.map((r) => r.judge?.style).filter((v): v is number => v != null),
      ),
      avgCostUsd: mean(completed.map((r) => r.costUsd).filter((v): v is number => v != null)),
      avgLatencyMs: mean(completed.map((r) => r.latencyMs)),
      avgWordCount: mean(
        completed.map((r) => r.metrics?.wordCount).filter((v): v is number => v != null),
      ),
      validationPassRate:
        withValidation.length > 0
          ? withValidation.filter((r) => r.validationPassed === true).length / withValidation.length
          : null,
    };
  });
}

function fmt(value: number | null, digits = 1, suffix = ""): string {
  return value == null ? "—" : `${value.toFixed(digits)}${suffix}`;
}

/** Tabla Markdown lista para pegar en la memoria: la frontera coste/calidad por configuración. */
export function renderMarkdownReport(aggregates: ConfigAggregate[]): string {
  const header = [
    "| Configuración | Casos | Errores | Juez (global) | Fidelidad | Estilo | Validación | Coste medio (USD) | Latencia media (s) | Palabras |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const rows = aggregates.map(
    (a) =>
      [
        `| ${a.configId}`,
        a.cases,
        a.errors,
        fmt(a.avgJudgeOverall),
        fmt(a.avgJudgeFaithfulness),
        fmt(a.avgJudgeStyle),
        a.validationPassRate == null ? "—" : `${(a.validationPassRate * 100).toFixed(0)}%`,
        fmt(a.avgCostUsd, 4),
        fmt(a.avgLatencyMs == null ? null : a.avgLatencyMs / 1000),
        fmt(a.avgWordCount, 0),
      ].join(" | ") + " |",
  );
  return [...header, ...rows].join("\n");
}
