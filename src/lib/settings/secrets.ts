import { decryptSecretDetailed, encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db/client";

/**
 * Repositorio de secretos cifrados. Toda lectura/escritura de claves de API de terceros
 * pasa por aquí, de modo que el cifrado/descifrado ocurre en un único sitio y el resto de
 * la app trabaja con texto en claro solo en memoria del servidor.
 */

/** Devuelve el secreto descifrado, o null si no está configurado. SOLO servidor. */
export async function getSecret(key: string): Promise<string | null> {
  const row = await prisma.secret.findUnique({ where: { key } });
  if (!row) return null;

  const { plaintext, needsRotation } = decryptSecretDetailed(row.ciphertext);
  if (needsRotation) {
    // Re-cifrado perezoso (ADR 0007): el secreto venía cifrado con la clave anterior o en
    // el formato legado; se re-cifra con la clave actual al leerlo. Best-effort: si la
    // escritura falla, el valor descifrado se devuelve igualmente y se reintentará en la
    // próxima lectura.
    try {
      await prisma.secret.update({
        where: { key },
        data: { ciphertext: encryptSecret(plaintext) },
      });
    } catch {
      // Nada: la rotación perezosa no debe romper una lectura válida.
    }
  }
  return plaintext;
}

/** Guarda (o actualiza) un secreto, cifrándolo en reposo. */
export async function setSecret(key: string, plaintext: string): Promise<void> {
  const ciphertext = encryptSecret(plaintext);
  await prisma.secret.upsert({
    where: { key },
    update: { ciphertext },
    create: { key, ciphertext },
  });
}

/** Elimina un secreto si existe. */
export async function deleteSecret(key: string): Promise<void> {
  await prisma.secret.deleteMany({ where: { key } });
}

/**
 * Estado seguro de un secreto para mostrar en la UI: indica si está configurado y, en su
 * caso, una versión enmascarada. Nunca devuelve el valor en claro al cliente.
 */
export async function getSecretStatus(
  key: string,
): Promise<{ configured: boolean; masked: string | null }> {
  const value = await getSecret(key);
  return value
    ? { configured: true, masked: maskSecret(value) }
    : { configured: false, masked: null };
}
