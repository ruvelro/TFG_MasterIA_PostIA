import { beforeAll, describe, expect, it } from "vitest";

import {
  authenticateApiKey,
  createApiKeyForUser,
  hashApiKey,
  listApiKeysForUser,
  revokeApiKey,
} from "@/lib/api-keys/service";
import { prisma } from "@/lib/db/client";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "API", email: `apikey_${Date.now()}@postia.test` },
  });
  userId = user.id;
});

describe("claves de la API pública", () => {
  it("crea una clave y solo persiste su hash (nunca el texto en claro)", async () => {
    const created = await createApiKeyForUser(userId, "Integración CMS");
    expect(created.plaintext.startsWith("postia_")).toBe(true);
    expect(created.prefix).toBe(created.plaintext.slice(0, 14));

    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.keyHash).toBe(hashApiKey(created.plaintext));
    expect(row.keyHash).not.toContain(created.plaintext);
    // El listado para la UI tampoco expone el hash.
    const listed = await listApiKeysForUser(userId);
    expect(JSON.stringify(listed)).not.toContain(row.keyHash);
  });

  it("autentica por cabecera Bearer y registra el último uso", async () => {
    const created = await createApiKeyForUser(userId, "Clave válida");
    const auth = await authenticateApiKey(`Bearer ${created.plaintext}`);
    expect(auth?.userId).toBe(userId);
  });

  it.each([
    null,
    "Bearer",
    "Bearer clave-inventada",
    "Bearer postia_clave-que-no-existe",
    "Basic postia_algo",
  ])("rechaza la cabecera %s", async (header) => {
    expect(await authenticateApiKey(header)).toBeNull();
  });

  it("una clave revocada deja de autenticar al instante", async () => {
    const created = await createApiKeyForUser(userId, "Para revocar");
    expect(await authenticateApiKey(`Bearer ${created.plaintext}`)).not.toBeNull();

    expect(await revokeApiKey(userId, created.id)).toBe(true);
    expect(await authenticateApiKey(`Bearer ${created.plaintext}`)).toBeNull();
    // Revocar de nuevo (o una clave ajena) devuelve false sin efectos.
    expect(await revokeApiKey(userId, created.id)).toBe(false);
  });

  it("no permite revocar claves de otro usuario", async () => {
    const other = await prisma.user.create({
      data: { name: "Otro", email: `apikey_otro_${Date.now()}@postia.test` },
    });
    const created = await createApiKeyForUser(other.id, "Ajena");
    expect(await revokeApiKey(userId, created.id)).toBe(false);
    expect(await authenticateApiKey(`Bearer ${created.plaintext}`)).not.toBeNull();
  });
});
