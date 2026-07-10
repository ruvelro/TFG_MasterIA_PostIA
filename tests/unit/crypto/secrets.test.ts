import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decryptSecret,
  decryptSecretDetailed,
  encryptSecret,
  maskSecret,
} from "@/lib/crypto/secrets";

// Claves de prueba (32 bytes en base64) para los tests de rotación.
const KEY_A = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="; // la de vitest.config.ts
const KEY_B = "YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODk=";

/**
 * Recarga el módulo de secretos con otras claves de entorno: el módulo captura la KEK al
 * cargarse, así que probar la rotación exige reimportarlo con el entorno alterado.
 */
async function loadSecretsWithEnv(current: string, previous?: string) {
  vi.resetModules();
  vi.stubEnv("ENCRYPTION_KEY", current);
  if (previous === undefined) {
    vi.stubEnv("ENCRYPTION_KEY_PREVIOUS", "");
    delete process.env.ENCRYPTION_KEY_PREVIOUS;
  } else {
    vi.stubEnv("ENCRYPTION_KEY_PREVIOUS", previous);
  }
  return import("@/lib/crypto/secrets");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

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

  it("prefija el payload con la versión del esquema (v1)", () => {
    expect(encryptSecret("dato").startsWith("v1.")).toBe(true);
  });

  it("falla si el ciphertext ha sido manipulado (integridad)", () => {
    const payload = encryptSecret("dato-sensible");
    const [version, iv, tag] = payload.split(".");
    // Alteramos el ciphertext: GCM debe detectar la manipulación.
    const tampered = `${version}.${iv}.${tag}.${Buffer.from("otra-cosa").toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rechaza un payload con formato inválido", () => {
    expect(() => decryptSecret("no-es-un-payload-valido")).toThrow("inválido");
  });

  it("rechaza una versión de esquema desconocida", () => {
    const [, iv, tag, data] = encryptSecret("dato").split(".");
    expect(() => decryptSecret(`v9.${iv}.${tag}.${data}`)).toThrow("no soportada");
  });

  it("enmascara dejando solo los últimos 4 caracteres", () => {
    expect(maskSecret("sk-or-v1-abcd1234")).toBe("••••1234");
    expect(maskSecret("xy")).toBe("••••");
  });
});

describe("rotación de la KEK (ADR 0007)", () => {
  it("acepta el formato legado sin versión y lo marca para re-cifrado", () => {
    const legacy = encryptSecret("secreto-antiguo").replace(/^v1\./, "");
    const result = decryptSecretDetailed(legacy);
    expect(result.plaintext).toBe("secreto-antiguo");
    expect(result.needsRotation).toBe(true);
  });

  it("no marca para re-cifrado un payload cifrado con la clave actual", () => {
    const result = decryptSecretDetailed(encryptSecret("secreto-vigente"));
    expect(result.needsRotation).toBe(false);
  });

  it("descifra con la clave anterior durante la rotación y lo marca para re-cifrado", async () => {
    // Ciframos con la clave A (la vigente hasta ahora)…
    const withKeyA = await loadSecretsWithEnv(KEY_A);
    const payload = withKeyA.encryptSecret("secreto-rotado");

    // …y rotamos: B pasa a ser la actual y A queda como ENCRYPTION_KEY_PREVIOUS.
    const rotated = await loadSecretsWithEnv(KEY_B, KEY_A);
    const result = rotated.decryptSecretDetailed(payload);
    expect(result.plaintext).toBe("secreto-rotado");
    expect(result.needsRotation).toBe(true);

    // Lo re-cifrado con B ya no necesita rotación.
    const reencrypted = rotated.encryptSecret(result.plaintext);
    expect(rotated.decryptSecretDetailed(reencrypted).needsRotation).toBe(false);
  });

  it("falla con un error claro si ninguna clave descifra el payload", async () => {
    const withKeyA = await loadSecretsWithEnv(KEY_A);
    const payload = withKeyA.encryptSecret("secreto-perdido");

    // Rotación mal hecha: la clave anterior no se configuró.
    const rotated = await loadSecretsWithEnv(KEY_B);
    expect(() => rotated.decryptSecret(payload)).toThrow();
  });
});
