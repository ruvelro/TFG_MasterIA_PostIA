import { prisma } from "@/lib/db/client";

// Repositorio de ajustes NO sensibles (texto en claro): proveedor de búsqueda activo,
// id del motor de Google CSE, etc.

export async function getAppSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
