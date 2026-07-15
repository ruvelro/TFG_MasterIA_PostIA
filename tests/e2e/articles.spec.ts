import { expect, test, type Page } from "@playwright/test";

// Reutiliza el modo E2E (deps falsas): genera un artículo y verifica el ciclo del historial.
function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e4)}@postia.test`;
}

const STRONG_PASSWORD = "Tfg-PostIA-2026!";

async function registerAndGenerate(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Usuario Historial");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/generate/);

  await page.getByLabel("Tema del artículo").fill("Tendencias de movilidad eléctrica");
  await page.getByLabel("Revisar los datos extraídos antes de redactar").uncheck();
  await page.getByRole("button", { name: "Generar artículo" }).click();
  await expect(page.getByRole("heading", { name: "Artículo de ejemplo" })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("historial de artículos", () => {
  test("genera, ve el detalle con traza y borra el artículo", async ({ page }) => {
    await registerAndGenerate(page);

    // Enlace desde el resultado hacia su entrada en el historial.
    await page.getByRole("link", { name: "Ver en historial" }).click();
    await expect(page).toHaveURL(/\/articles\/.+/);
    await expect(page.getByRole("heading", { name: "Artículo de ejemplo" })).toBeVisible();

    // La traza de generación está disponible.
    await expect(page.getByText("Detalles de generación")).toBeVisible();
    await expect(page.getByRole("link", { name: "Descargar Markdown" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista publicada" })).toBeVisible();

    // Borrado con confirmación.
    page.on("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/\/articles$/);
    await expect(page.getByText("Aún no has generado ningún artículo.")).toBeVisible();
  });

  test("el artículo aparece en el listado", async ({ page }) => {
    await registerAndGenerate(page);

    await page.goto("/articles");
    await expect(page.getByRole("link", { name: "Artículo de ejemplo" })).toBeVisible();

    await page.getByRole("button", { name: "Vista publicada" }).click();
    const preview = page.getByRole("dialog", { name: "Vista previa del artículo" });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("heading", { name: "Artículo de ejemplo" })).toBeVisible();
    await expect(preview.getByText("Meta description de ejemplo para el modo E2E.")).toBeVisible();
  });
});
