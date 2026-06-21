import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Setup global de Vitest: prepara una base de datos SQLite DEDICADA y LIMPIA (`test.db`)
 * para los tests de integración que tocan Prisma (p. ej. el orquestador). Coincide con el
 * `DATABASE_URL` que se inyecta en `vitest.config.ts > test.env`.
 */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: "file:./test.db" };
  for (const file of ["test.db", "test.db-journal"]) {
    rmSync(file, { force: true });
  }
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
}
