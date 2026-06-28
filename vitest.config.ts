import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Configuración de Vitest.
//
// - Entorno por defecto `node`: la mayoría de tests son de lógica de dominio pura y no
//   necesitan DOM. Los tests de componentes React declaran su entorno por fichero con el
//   docblock `// @vitest-environment jsdom`, evitando así el coste de jsdom donde no hace falta.
// - `resolve.tsconfigPaths` resuelve el alias `@/*` de forma nativa (Vite ya no necesita
//   el plugin vite-tsconfig-paths).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Prepara una BD de test limpia para los tests de integración que usan Prisma.
    globalSetup: ["./tests/vitest.global-setup.ts"],
    environment: "node",
    // Entorno controlado para los tests: así la validación fail-fast de `lib/config/env`
    // no obliga a tener un `.env` real para ejecutar la suite. Valores deterministas y
    // sin secretos reales.
    env: {
      DATABASE_URL: "file:./test.db",
      AUTH_SECRET: "test-secret-do-not-use-in-prod-0123456789",
      // Clave AES-256 (32 bytes) en base64, solo para los tests. No es un secreto real.
      ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    },
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Solo medimos cobertura de nuestra lógica de dominio, no de la UI ni los tipos.
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/types.ts"],
      // Umbrales que actúan de trinquete: por debajo del nivel actual para no romper hoy, pero
      // suficientes para que una regresión de cobertura falle el CI. Súbelos al añadir tests.
      thresholds: {
        statements: 78,
        branches: 67,
        functions: 74,
        lines: 80,
      },
    },
  },
});
