-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "runId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT,
    "featuredImagePath" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Article_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Article_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Article_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("contentMarkdown", "createdAt", "featuredImagePath", "id", "keywords", "metaDescription", "metadataJson", "runId", "slug", "title", "updatedAt", "userId") SELECT "contentMarkdown", "createdAt", "featuredImagePath", "id", "keywords", "metaDescription", "metadataJson", "runId", "slug", "title", "updatedAt", "userId" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_runId_key" ON "Article"("runId");
CREATE INDEX "Article_userId_idx" ON "Article"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
