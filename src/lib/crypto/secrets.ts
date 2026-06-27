import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/config/env";

/**
 * Cifrado autenticado de secretos en reposo (AES-256-GCM).
 *
 * Lo usamos para guardar en la base de datos las claves de API de terceros (OpenRouter,
 * buscadores) sin almacenarlas en claro. GCM aporta confidencialidad e integridad: si el
 * ciphertext o el IV se manipulan, el descifrado falla (no devuelve datos corruptos).
 *
 * La clave maestra (KEK) vive en `env.ENCRYPTION_KEY` (32 bytes), nunca en la BD.
 */
const ALGORITHM = "aes-256-gcm";
// 96 bits es el tamaño de IV recomendado para GCM (mejor rendimiento y seguridad).
const IV_LENGTH = 12;
const SEPARATOR = ".";

const key = Buffer.from(env.ENCRYPTION_KEY, "base64");

/** Cifra un texto. Devuelve `base64(iv).base64(tag).base64(ciphertext)`. */
export function encryptSecret(plaintext: string): string {
  // IV aleatorio por operación: nunca reutilizar IV con la misma clave en GCM.
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString("base64")).join(SEPARATOR);
}

/** Descifra un payload generado por `encryptSecret`. Lanza si fue manipulado. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(SEPARATOR);
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de secreto cifrado inválido");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Enmascara un secreto para mostrarlo en la UI sin revelarlo: solo deja ver los últimos
 * 4 caracteres. Es lo único que el cliente llega a recibir de una clave guardada.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}
