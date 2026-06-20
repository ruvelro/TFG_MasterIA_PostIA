import { expect, test } from "@playwright/test";

// Verifica la barrera de autenticación de extremo a extremo contra el build real.
test.describe("autenticación", () => {
  test("redirige a /login al entrar en una ruta protegida sin sesión", async ({ page }) => {
    await page.goto("/generate");
    await expect(page).toHaveURL(/\/login/);
  });

  test("inicia sesión con el usuario demo y accede al generador", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@postia.app");
    await page.getByLabel("Contraseña").fill("Demo1234!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/generate/);
    await expect(page.getByRole("heading", { name: "Generar artículo" })).toBeVisible();
  });

  test("rechaza credenciales incorrectas con un mensaje de error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@postia.app");
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Apuntamos al texto del mensaje: hay otros elementos con role="alert" en la página
    // (el anunciador de rutas de Next), por lo que getByRole("alert") sería ambiguo.
    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
