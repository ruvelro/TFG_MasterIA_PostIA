-- Conserva la procedencia y la clasificación de seguridad al pausar y reanudar.
ALTER TABLE "GenerationSource" ADD COLUMN "userProvided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GenerationSource" ADD COLUMN "suspicious" BOOLEAN NOT NULL DEFAULT false;
