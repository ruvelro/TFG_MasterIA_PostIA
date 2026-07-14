import { writeFile } from "node:fs/promises";

import {
  AI_STAGE_IDS,
  DEFAULT_PIPELINE_PARAMS,
  DEFAULT_STEP_CONFIG,
} from "../src/lib/pipeline/default-config";

async function main(): Promise<void> {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("Falta la ruta del artefacto de configuración predeterminada");

  const artifact = {
    steps: AI_STAGE_IDS.map((stageId) => ({
      stageId,
      model: DEFAULT_STEP_CONFIG[stageId].model,
      prompt: DEFAULT_STEP_CONFIG[stageId].prompt,
    })),
    appSettings: {
      ai_score_threshold: String(DEFAULT_PIPELINE_PARAMS.aiScoreThreshold),
    },
  };

  await writeFile(outputPath, JSON.stringify(artifact), "utf8");
}

void main();
