import { expect, test, type Page } from "@playwright/test";

// El generador corre con dependencias FALSAS (E2E=true en el webServer), así que el flujo
// completo es determinista y no necesita claves de OpenRouter ni de búsqueda.
function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e4)}@postia.test`;
}

const STRONG_PASSWORD = "Tfg-PostIA-2026!";

async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Usuario Generador");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/generate/);
}

test.describe("generador de artículos", () => {
  test("avisa cuando el tema se parece a un artículo anterior", async ({ page }) => {
    await register(page);
    await page.route("**/api/topics/similar", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ topic: "Final del Mundial 2026" });
      await route.fulfill({
        json: {
          similar: [
            {
              articleId: "article-previous",
              title: "España en la final del Mundial 2026",
              similarity: 0.94,
            },
          ],
        },
      });
    });

    await page.getByLabel("Tema del artículo").fill("Final del Mundial 2026");
    await page.getByLabel("Contexto adicional (opcional)").click();

    await expect(page.getByText("Este tema se parece a artículos que ya generaste:")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "España en la final del Mundial 2026" }),
    ).toHaveAttribute("href", "/articles/article-previous");
  });

  test("genera con revisión de hechos y muestra el artículo", async ({ page }) => {
    await register(page);

    await page.getByLabel("Tema del artículo").fill("Tendencias de energía solar");
    await page.getByRole("button", { name: "Generar artículo" }).click();

    // Pausa de revisión: aparece la pantalla de hechos editables.
    await expect(page.getByRole("heading", { name: "Revisa los datos extraídos" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Continuar y redactar" }).click();

    // Resultado final.
    await expect(page.getByRole("heading", { name: "Artículo de ejemplo" })).toBeVisible({
      timeout: 20_000,
    });
    // El cuerpo del artículo (Markdown) se ha renderizado.
    await expect(page.getByRole("heading", { name: "Borrador de ejemplo" })).toBeVisible();
  });

  test("genera sin revisión y va directo al artículo", async ({ page }) => {
    await register(page);

    await page.getByLabel("Tema del artículo").fill("Coches eléctricos en 2026");
    await page.getByLabel("Revisar los datos extraídos antes de redactar").uncheck();
    await page.getByRole("button", { name: "Generar artículo" }).click();

    await expect(page.getByRole("heading", { name: "Artículo de ejemplo" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
