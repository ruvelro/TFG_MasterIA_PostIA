import { defineConfig, devices } from "@playwright/test";

// Configuración de Playwright para los tests end-to-end.
// `webServer` arranca la app en modo producción para que los e2e prueben el build real;
// reutiliza un servidor ya levantado en local para iterar más rápido.
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
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
  },
});
