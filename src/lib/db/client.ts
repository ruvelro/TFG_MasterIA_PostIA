import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { env } from "@/lib/config/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma único de la aplicación.
 *
 * Prisma 7 requiere un *driver adapter* explícito en runtime (la URL ya no vive en el
 * esquema). Usamos better-sqlite3 por ser síncrono y sin dependencias de red.
 *
 * El patrón singleton sobre `globalThis` evita que el *hot reload* de Next en desarrollo
 * abra una conexión nueva en cada recarga (lo que agotaría descriptores de fichero). En
 * producción se crea una sola instancia normal.
 */
const createPrismaClient = () =>
  new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: env.DATABASE_URL }) });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
