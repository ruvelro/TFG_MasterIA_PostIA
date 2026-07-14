import { readFile } from "node:fs/promises";

import Database from "better-sqlite3";

function databasePathFromUrl(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL debe usar SQLite con el prefijo file:");
  }
  return databaseUrl.slice("file:".length);
}

const artifactPath =
  process.env.RUNTIME_DEFAULTS_PATH ?? new URL("../runtime-defaults.json", import.meta.url);
const raw = await readFile(artifactPath, "utf8");
const artifact = JSON.parse(raw);
const db = new Database(databasePathFromUrl(process.env.DATABASE_URL));
const now = new Date().toISOString();

const syncStep = db.prepare(`
  INSERT INTO PipelineStepConfig (stageId, model, prompt, createdAt, updatedAt)
  VALUES (@stageId, @model, @prompt, @now, @now)
  ON CONFLICT(stageId) DO UPDATE SET
    prompt = excluded.prompt,
    updatedAt = excluded.updatedAt
`);
const syncSetting = db.prepare(`
  INSERT INTO AppSetting (key, value, createdAt, updatedAt)
  VALUES (@key, @value, @now, @now)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updatedAt = excluded.updatedAt
`);

const syncDefaults = db.transaction(() => {
  for (const step of artifact.steps) syncStep.run({ ...step, now });
  for (const [key, value] of Object.entries(artifact.appSettings)) {
    syncSetting.run({ key, value, now });
  }
});

try {
  syncDefaults();
} finally {
  db.close();
}

console.log(
  `→ Sincronizados ${artifact.steps.length} prompts predeterminados y el umbral de humanización`,
);
