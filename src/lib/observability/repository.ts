import { prisma } from "@/lib/db/client";

import type { ErrorCategory } from "./error-log";

/** Fila de error ya serializada para la UI (fecha como epoch ms, sin objetos Date). */
export interface ErrorLogRow {
  id: string;
  category: string;
  message: string;
  detail: string | null;
  userId: string | null;
  createdAt: number;
}

/**
 * Devuelve los errores más recientes, opcionalmente filtrados por categoría. Pensado para el panel
 * de administración: limita el número de filas para no traer un histórico ilimitado.
 */
export async function listErrorLogs(opts?: {
  category?: ErrorCategory;
  limit?: number;
}): Promise<ErrorLogRow[]> {
  const rows = await prisma.errorLog.findMany({
    where: opts?.category ? { category: opts.category } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 200,
  });
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    detail: row.detail,
    userId: row.userId,
    createdAt: row.createdAt.getTime(),
  }));
}
