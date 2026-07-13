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
  /**
   * Desviación típica (muestral) de las magnitudes con más dispersión entre casos. Acompaña a la
   * media para no comparar configuraciones con una sola cifra: sin la variabilidad, una diferencia
   * de medias puede ser ruido. `null` si hay menos de dos casos completados con dato.
   */
  sdJudgeOverall: number | null;
  sdCostUsd: number | null;
  sdLatencyMs: number | null;
  /** Tasa de casos con validación superada (solo modo pipeline; null si no aplica). */
  validationPassRate: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Desviación típica MUESTRAL (divisor n-1): estimamos la dispersión de una población a partir de
 * una muestra de casos, no describimos la muestra en sí. Necesita al menos dos valores.
 */
function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
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
    const judgeOverall = completed
      .map((r) => r.judge?.overall)
      .filter((v): v is number => v != null);
    const costs = completed.map((r) => r.costUsd).filter((v): v is number => v != null);
    const latencies = completed.map((r) => r.latencyMs);
    return {
      configId,
      cases: list.length,
      errors: list.length - completed.length,
      avgJudgeOverall: mean(judgeOverall),
      avgJudgeFaithfulness: mean(
        completed.map((r) => r.judge?.faithfulness).filter((v): v is number => v != null),
      ),
      avgJudgeStyle: mean(
        completed.map((r) => r.judge?.style).filter((v): v is number => v != null),
      ),
      avgCostUsd: mean(costs),
      avgLatencyMs: mean(latencies),
      avgWordCount: mean(
        completed.map((r) => r.metrics?.wordCount).filter((v): v is number => v != null),
      ),
      sdJudgeOverall: stdDev(judgeOverall),
      sdCostUsd: stdDev(costs),
      sdLatencyMs: stdDev(latencies),
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

/** Media ± desviación típica en una sola celda; omite el ± cuando no hay dispersión estimable. */
function fmtMeanSd(avg: number | null, sd: number | null, digits = 1): string {
  if (avg == null) return "—";
  const base = avg.toFixed(digits);
  return sd == null ? base : `${base} ± ${sd.toFixed(digits)}`;
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
        fmtMeanSd(a.avgJudgeOverall, a.sdJudgeOverall),
        fmt(a.avgJudgeFaithfulness),
        fmt(a.avgJudgeStyle),
        a.validationPassRate == null ? "—" : `${(a.validationPassRate * 100).toFixed(0)}%`,
        fmtMeanSd(a.avgCostUsd, a.sdCostUsd, 4),
        fmtMeanSd(
          a.avgLatencyMs == null ? null : a.avgLatencyMs / 1000,
          a.sdLatencyMs == null ? null : a.sdLatencyMs / 1000,
        ),
        fmt(a.avgWordCount, 0),
      ].join(" | ") + " |",
  );
  return [...header, ...rows].join("\n");
}
