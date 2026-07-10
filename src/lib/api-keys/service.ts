import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/client";

/**
 * Claves de la API pública, por usuario. La clave en claro solo existe en el momento de
 * crearla (se devuelve una vez y no se vuelve a mostrar); en la BD vive únicamente su hash
 * SHA-256. Al ser secretos ALEATORIOS de 256 bits, un hash rápido es la elección correcta:
 * los KDF lentos (scrypt) protegen secretos de baja entropía como contraseñas, y aquí solo
 * encarecerían cada petición autenticada.
 */

const KEY_PREFIX = "postia_";
/** Caracteres visibles de la clave para identificarla en la UI sin revelarla. */
const VISIBLE_PREFIX_LENGTH = 14;

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export interface CreatedApiKey {
  id: string;
  name: string;
  /** La clave en claro: SOLO se devuelve aquí, una vez. */
  plaintext: string;
  prefix: string;
}

export async function createApiKeyForUser(userId: string, name: string): Promise<CreatedApiKey> {
  const plaintext = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const prefix = plaintext.slice(0, VISIBLE_PREFIX_LENGTH);
  const created = await prisma.apiKey.create({
    data: { userId, name, keyHash: hashApiKey(plaintext), prefix },
    select: { id: true, name: true },
  });
  return { id: created.id, name: created.name, plaintext, prefix };
}

/** Revoca una clave del usuario (idempotente). Devuelve false si no existe o es ajena. */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/** Claves del usuario para la UI: nunca incluye el hash ni la clave. */
export function listApiKeysForUser(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}

/**
 * Autentica una petición de la API pública por su cabecera `Authorization: Bearer <clave>`.
 * Devuelve el usuario propietario o null (clave ausente, desconocida o revocada).
 */
export async function authenticateApiKey(
  authorizationHeader: string | null,
): Promise<{ userId: string } | null> {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  const plaintext = match?.[1]?.trim();
  if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(plaintext) },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!key || key.revokedAt) return null;

  // Última actividad, best-effort: útil para auditar claves olvidadas; no bloquea el request.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: key.userId };
}
