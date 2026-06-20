import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto/secrets";

describe("cifrado de secretos (AES-256-GCM)", () => {
  it("descifra al valor original (round-trip)", () => {
    const secret = "sk-or-v1-ejemplo-de-clave-openrouter";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("nunca expone el texto en claro en el payload cifrado", () => {
    const secret = "sk-or-v1-supersecreto";
    const payload = encryptSecret(secret);
    expect(payload).not.toContain(secret);
  });

  it("produce un ciphertext distinto cada vez (IV aleatorio)", () => {
    const secret = "mismo-secreto";
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it("falla si el ciphertext ha sido manipulado (integridad)", () => {
    const payload = encryptSecret("dato-sensible");
    const [iv, tag, data] = payload.split(".");
    // Alteramos un byte del ciphertext: GCM debe detectar la manipulación.
    const tampered = `${iv}.${tag}.${Buffer.from("otra-cosa").toString("base64")}`;
    void data;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rechaza un payload con formato inválido", () => {
    expect(() => decryptSecret("no-es-un-payload-valido")).toThrow("inválido");
  });

  it("enmascara dejando solo los últimos 4 caracteres", () => {
    expect(maskSecret("sk-or-v1-abcd1234")).toBe("••••1234");
    expect(maskSecret("xy")).toBe("••••");
  });
});
