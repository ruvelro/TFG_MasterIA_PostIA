import { expect, test } from "@playwright/test";

// La BD de e2e está limpia (global-setup), y este fichero corre antes que los demás
// (orden alfabético, un único worker), por lo que el primer usuario que registremos aquí
// será el administrador del sistema.
function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e4)}@postia.test`;
}

const STRONG_PASSWORD = "Tfg-PostIA-2026!";

async function register(page: import("@playwright/test").Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Usuario E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/generate/);
}

test.describe("panel de administración", () => {
  test("el primer usuario es admin y puede guardar la clave de OpenRouter (enmascarada)", async ({
    page,
  }) => {
    await register(page, uniqueEmail());

    // El enlace de administración solo aparece para administradores.
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();

    // Guardamos una clave de prueba; al volver, debe mostrarse enmascarada (últimos 4).
    await page.getByLabel("OpenRouter API Key").fill("sk-or-test-1234");
    await page.getByRole("button", { name: "Guardar claves" }).click();

    await expect(page.getByPlaceholder(/Configurada \(••••1234\)/)).toBeVisible();
  });

  test("un usuario no administrador no puede entrar en /admin", async ({ page }) => {
    // Segundo usuario registrado: rol normal, sin acceso al panel.
    await register(page, uniqueEmail());

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/generate/);
  });
});
