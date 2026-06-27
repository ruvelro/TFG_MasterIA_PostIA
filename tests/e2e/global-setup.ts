import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Preparación global de los e2e: usa una base de datos SQLite DEDICADA y LIMPIA
 * (`e2e.db`), separada de la de desarrollo. Empezar de cero es necesario para probar el
 * bootstrap de administrador (el primer usuario registrado se convierte en admin).
 *
 * `DATABASE_URL` también se fija en el `webServer` de playwright.config para que la app
 * bajo prueba use esta misma base de datos.
 */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };

  // Partimos de un fichero limpio en cada ejecución de la suite.
  for (const file of ["e2e.db", "e2e.db-journal"]) {
    rmSync(file, { force: true });
  }

  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
}
