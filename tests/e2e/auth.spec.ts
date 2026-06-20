import { expect, test } from "@playwright/test";

// Email único por ejecución: la BD de desarrollo persiste entre runs, así evitamos
// colisiones de "email ya registrado".
function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e4)}@postia.test`;
}

const STRONG_PASSWORD = "Tfg-PostIA-2026!";

test.describe("autenticación", () => {
  test("redirige a /login al entrar en una ruta protegida sin sesión", async ({ page }) => {
    await page.goto("/generate");
    await expect(page).toHaveURL(/\/login/);
  });

  test("registro, cierre y nuevo inicio de sesión", async ({ page }) => {
    const email = uniqueEmail();

    // Registro: tras crear la cuenta, el auto-login lleva al generador.
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Usuario E2E");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/generate/);

    // Cierre de sesión.
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Nuevo inicio de sesión con las mismas credenciales.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/generate/);
    await expect(page.getByRole("heading", { name: "Generar artículo" })).toBeVisible();
  });

  test("rechaza credenciales incorrectas con un mensaje genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("noexiste@postia.test");
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el registro exige una contraseña fuerte", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Usuario E2E");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Contraseña").fill("debil");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // No debe navegar al generador; muestra el error de política. Apuntamos al texto
    // (hay otro role="alert" en la página: el anunciador de rutas de Next).
    await expect(page.getByText("La contraseña debe tener al menos 12 caracteres")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("registra una passkey y la usa para iniciar sesión", async ({ page, context }) => {
    const email = uniqueEmail();

    // Autenticador virtual de WebAuthn vía CDP: simula una passkey de plataforma con
    // verificación de usuario automática, para poder probar el flujo sin hardware real.
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        automaticPresenceSimulation: true,
        isUserVerified: true,
      },
    });

    // Registro de la cuenta.
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Usuario Passkey");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/generate/);

    // El gestor pide el nombre con window.prompt: lo aceptamos automáticamente.
    page.on("dialog", (dialog) => void dialog.accept("Passkey E2E"));
    await page.goto("/account");
    await page.getByRole("button", { name: "Añadir passkey" }).click();
    await expect(page.getByText("Passkey E2E")).toBeVisible();

    // Cerramos sesión y entramos de nuevo usando solo la passkey.
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole("button", { name: "Entrar con passkey" }).click();
    await expect(page).toHaveURL(/\/generate/);
  });
});
