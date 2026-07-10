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
 *
 * Rotación de la KEK (ADR 0007): el payload lleva un prefijo de versión (`v1.iv.tag.data`)
 * que identifica el esquema con el que se cifró. Para rotar la clave se pone la nueva en
 * `ENCRYPTION_KEY` y la anterior en `ENCRYPTION_KEY_PREVIOUS`: el descifrado prueba la
 * actual y cae a la anterior, y el repositorio re-cifra de forma perezosa (al leer) con la
 * clave nueva. Cuando todos los secretos se han re-cifrado, la variable previa se retira.
 * Los payloads antiguos sin versión (`iv.tag.data`) se siguen aceptando y se marcan para
 * re-cifrado.
 */
const ALGORITHM = "aes-256-gcm";
// 96 bits es el tamaño de IV recomendado para GCM (mejor rendimiento y seguridad).
const IV_LENGTH = 12;
const SEPARATOR = ".";
// Versión del esquema de cifrado. Si algún día cambia el algoritmo o el formato, se
// introduce "v2" y este módulo sabrá descifrar ambos durante la transición.
const PAYLOAD_VERSION = "v1";

const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
const previousKey = env.ENCRYPTION_KEY_PREVIOUS
  ? Buffer.from(env.ENCRYPTION_KEY_PREVIOUS, "base64")
  : null;

/** Cifra un texto con la clave ACTUAL. Devuelve `v1.base64(iv).base64(tag).base64(data)`. */
export function encryptSecret(plaintext: string): string {
  // IV aleatorio por operación: nunca reutilizar IV con la misma clave en GCM.
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const parts = [iv, authTag, ciphertext].map((part) => part.toString("base64"));
  return [PAYLOAD_VERSION, ...parts].join(SEPARATOR);
}

function decryptWith(kek: Buffer, ivB64: string, tagB64: string, dataB64: string): string {
  const decipher = createDecipheriv(ALGORITHM, kek, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export interface DecryptedSecret {
  plaintext: string;
  /**
   * True si el payload NO está cifrado con la clave actual (se descifró con la clave
   * anterior o es del formato legado sin versión): el llamador debe re-cifrarlo.
   */
  needsRotation: boolean;
}

/**
 * Descifra un payload e indica si necesita re-cifrado. Prueba la clave actual y, si el tag
 * de autenticación no cuadra, cae a `ENCRYPTION_KEY_PREVIOUS` (ventana de rotación). Lanza
 * si el formato es inválido, la versión es desconocida o ninguna clave puede descifrarlo.
 */
export function decryptSecretDetailed(payload: string): DecryptedSecret {
  const parts = payload.split(SEPARATOR);

  // Formato versionado actual (v1.iv.tag.data) o legado (iv.tag.data, pre-versionado).
  let legacy: boolean;
  let ivB64: string, tagB64: string, dataB64: string;
  if (parts.length === 4) {
    const version = parts[0];
    if (version !== PAYLOAD_VERSION) {
      throw new Error(`Versión de secreto cifrado no soportada ("${version}")`);
    }
    [ivB64, tagB64, dataB64] = [parts[1], parts[2], parts[3]];
    legacy = false;
  } else if (parts.length === 3) {
    [ivB64, tagB64, dataB64] = parts;
    legacy = true;
  } else {
    throw new Error("Formato de secreto cifrado inválido");
  }
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de secreto cifrado inválido");
  }

  try {
    return { plaintext: decryptWith(key, ivB64, tagB64, dataB64), needsRotation: legacy };
  } catch (error) {
    // GCM falla tanto por manipulación como por clave incorrecta: si hay clave anterior
    // configurada (rotación en curso), se intenta con ella antes de rendirse.
    if (previousKey) {
      try {
        return { plaintext: decryptWith(previousKey, ivB64, tagB64, dataB64), needsRotation: true };
      } catch {
        // Cae al error original: ninguna clave descifra el payload.
      }
    }
    throw error;
  }
}

/** Descifra un payload generado por `encryptSecret`. Lanza si fue manipulado. */
export function decryptSecret(payload: string): string {
  return decryptSecretDetailed(payload).plaintext;
}

/**
 * Enmascara un secreto para mostrarlo en la UI sin revelarlo: solo deja ver los últimos
 * 4 caracteres. Es lo único que el cliente llega a recibir de una clave guardada.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}
