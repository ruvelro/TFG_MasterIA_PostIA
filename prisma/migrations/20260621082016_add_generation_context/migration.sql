-- AlterTable
ALTER TABLE "GenerationRun" ADD COLUMN "contextJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GenerationStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "model" TEXT,
    "durationMs" INTEGER,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GenerationStep" ("createdAt", "durationMs", "error", "id", "model", "runId", "stageId", "status", "tokensInput", "tokensOutput") SELECT "createdAt", "durationMs", "error", "id", "model", "runId", "stageId", "status", "tokensInput", "tokensOutput" FROM "GenerationStep";
DROP TABLE "GenerationStep";
ALTER TABLE "new_GenerationStep" RENAME TO "GenerationStep";
CREATE INDEX "GenerationStep_runId_idx" ON "GenerationStep"("runId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
