import { defineConfig, devices } from "@playwright/test";

// Configuración de Playwright para los tests end-to-end.
// `webServer` arranca la app en modo producción para que los e2e prueben el build real;
// reutiliza un servidor ya levantado en local para iterar más rápido.
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Base de datos dedicada para e2e (separada de la de desarrollo). La crea/limpia el
// global-setup y la app la usa porque la inyectamos aquí en `webServer.env`.
const E2E_DATABASE_URL = "file:./e2e.db";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Un único worker: los e2e comparten una base de datos, así que se ejecutan en serie
  // para que su estado sea determinista (p. ej. quién es el primer usuario = admin).
  workers: 1,
  fullyParallel: false,
  // En CI fallamos si alguien deja un `test.only` olvidado y reintentamos los flakes.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Playwright añade estas variables a las del proceso; el resto (.env) las carga Next.
    // `E2E=true` desactiva el rate limiting de auth para que la suite sea determinista.
    // `APP_URL` se FIJA al base URL que sirve Playwright: es el `baseURL` de Better Auth y su
    // origen de confianza; si dependiera del `.env` de cada máquina (que en local puede
    // apuntar a otro puerto y en CI no existe), el registro fallaría con "Invalid origin".
    env: { DATABASE_URL: E2E_DATABASE_URL, E2E: "true", APP_URL: BASE_URL },
  },
});
