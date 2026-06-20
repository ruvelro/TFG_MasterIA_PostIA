import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashing de contraseñas", () => {
  it("nunca devuelve la contraseña en claro", async () => {
    const hash = await hashPassword("Demo1234!");
    expect(hash).not.toBe("Demo1234!");
    // Los hashes bcrypt empiezan por $2 (variante $2a/$2b).
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifica correctamente la contraseña correcta", async () => {
    const hash = await hashPassword("Demo1234!");
    await expect(verifyPassword("Demo1234!", hash)).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("Demo1234!");
    await expect(verifyPassword("incorrecta", hash)).resolves.toBe(false);
  });

  it("produce hashes distintos para la misma contraseña (salt aleatorio)", async () => {
    const [a, b] = await Promise.all([hashPassword("misma"), hashPassword("misma")]);
    expect(a).not.toBe(b);
  });
});
