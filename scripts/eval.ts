import "dotenv/config";

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { prisma } from "@/lib/db/client";
import { EVAL_CONFIGURATIONS, findConfiguration } from "@/lib/eval/configurations";
import { GOLDEN_TOPICS } from "@/lib/eval/golden-set";
import { judgeOverlapsPipeline, runEvalCase } from "@/lib/eval/runner";
import { buildPipelineConfig, buildPipelineDeps } from "@/lib/pipeline/build-deps";

/**
 * Harness de evaluación del pipeline (B1). Ejecuta el conjunto dorado de temas bajo varias
 * configuraciones y emite un registro JSONL por caso con calidad (juez LLM independiente +
 * métricas deterministas), coste y latencia. Los resultados alimentan la gráfica
 * coste/calidad de la memoria del TFM.
 *
 * Uso:
 *   npm run eval -- [--configs base,economico,llamada-unica] [--topics ia-regulacion-ue,...]
 *                   [--limit 3] [--judge-model openai/gpt-4o] [--out eval-results]
 *
 * Requiere la clave de OpenRouter y el buscador configurados en la app (BD), igual que una
 * generación normal. Los runs se persisten a nombre de un usuario "eval@postia.local".
 */

const DEFAULT_JUDGE_MODEL = "openai/gpt-4o";
const EVAL_USER_EMAIL = "eval@postia.local";

const { values } = parseArgs({
  options: {
    configs: { type: "string" },
    topics: { type: "string" },
    limit: { type: "string" },
    "judge-model": { type: "string" },
    out: { type: "string" },
  },
});

async function resolveEvalUserId(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: EVAL_USER_EMAIL } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: { name: "Harness de evaluación", email: EVAL_USER_EMAIL },
  });
  return created.id;
}

async function main(): Promise<void> {
  const judgeModel = values["judge-model"] ?? DEFAULT_JUDGE_MODEL;

  const configIds =
    values.configs?.split(",").map((id) => id.trim()) ?? EVAL_CONFIGURATIONS.map((c) => c.id);
  const configurations = configIds.map((id) => {
    const configuration = findConfiguration(id);
    if (!configuration) {
      throw new Error(
        `Configuración desconocida: "${id}". Disponibles: ${EVAL_CONFIGURATIONS.map((c) => c.id).join(", ")}`,
      );
    }
    return configuration;
  });

  const topicIds = values.topics?.split(",").map((id) => id.trim());
  let topics = topicIds
    ? GOLDEN_TOPICS.filter((topic) => topicIds.includes(topic.id))
    : [...GOLDEN_TOPICS];
  const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined;
  if (limit && limit > 0) topics = topics.slice(0, limit);
  if (topics.length === 0) throw new Error("No hay temas que evaluar (revisa --topics)");

  const [baseCfg, deps, userId] = await Promise.all([
    buildPipelineConfig(),
    buildPipelineDeps(),
    resolveEvalUserId(),
  ]);

  if (judgeOverlapsPipeline(baseCfg, judgeModel)) {
    console.warn(
      `⚠️  El modelo juez (${judgeModel}) coincide con un modelo del pipeline: hay riesgo de ` +
        "sesgo de auto-preferencia. Usa --judge-model para elegir otro.",
    );
  }

  const outDir = values.out ?? "eval-results";
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);

  const total = topics.length * configurations.length;
  let done = 0;
  console.log(
    `Evaluando ${topics.length} temas × ${configurations.length} configuraciones → ${outFile}\n`,
  );

  // Secuencial a propósito: N casos en paralelo dispararían el rate limit del proveedor y
  // contaminarían la medición de latencia.
  for (const configuration of configurations) {
    for (const golden of topics) {
      done += 1;
      process.stdout.write(`[${done}/${total}] ${configuration.id} × ${golden.id} … `);
      const record = await runEvalCase({
        golden,
        configuration,
        baseCfg,
        deps,
        userId,
        judgeModel,
      });
      appendFileSync(outFile, `${JSON.stringify(record)}\n`);
      if (record.status === "completed") {
        const cost = record.costUsd != null ? `$${record.costUsd.toFixed(4)}` : "s/coste";
        console.log(
          `ok (${(record.latencyMs / 1000).toFixed(1)}s · ${cost} · juez=${record.judge?.overall ?? "-"})`,
        );
      } else {
        console.log(`ERROR: ${record.error}`);
      }
    }
  }

  console.log(`\nResultados en ${outFile}`);
  console.log(`Agrega con: npm run eval:report -- ${outFile}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
