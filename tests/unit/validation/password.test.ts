import { describe, expect, it } from "vitest";

import { getPasswordError, passwordSchema } from "@/lib/validation/password";

describe("política de contraseñas", () => {
  it("acepta una contraseña fuerte", () => {
    expect(passwordSchema.safeParse("Tfg-PostIA-2026!").success).toBe(true);
    expect(getPasswordError("Tfg-PostIA-2026!")).toBeNull();
  });

  it.each([
    ["demasiado corta", "Ab1!xyz", "al menos 12"],
    ["sin mayúscula", "tfg-postia-2026!", "mayúscula"],
    ["sin minúscula", "TFG-POSTIA-2026!", "minúscula"],
    ["sin número", "Tfg-PostIA-Master!", "número"],
    ["sin símbolo", "TfgPostIA2026xx", "símbolo"],
  ])("rechaza una contraseña %s", (_caso, password, fragmento) => {
    const error = getPasswordError(password);
    expect(error).not.toBeNull();
    expect(error).toContain(fragmento);
  });

  it("rechaza contraseñas comunes aunque cumplan la complejidad (sin distinguir mayúsculas)", () => {
    // "Password123!" cumple longitud y variedad, pero al normalizar a minúsculas coincide
    // con "password123!" de la lista de bloqueo. Esto prueba además la comparación
    // case-insensitive (la entrada tiene una P mayúscula).
    expect(getPasswordError("Password123!")).toContain("común");
  });
});
