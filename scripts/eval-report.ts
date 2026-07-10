import { readFileSync } from "node:fs";

import { aggregateEvalRecords, renderMarkdownReport } from "@/lib/eval/report";
import type { EvalRecord } from "@/lib/eval/runner";

/**
 * Agrega un fichero JSONL del harness (`npm run eval`) en una tabla por configuración:
 * calidad media del juez, métricas del pipeline, coste y latencia medios. La salida en
 * Markdown se pega directamente en la memoria del TFM.
 *
 * Uso: npm run eval:report -- eval-results/eval-<fecha>.jsonl
 */
function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: npm run eval:report -- <fichero.jsonl>");
    process.exitCode = 1;
    return;
  }

  const records = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalRecord);

  const aggregates = aggregateEvalRecords(records);
  console.log(renderMarkdownReport(aggregates));
}

main();
