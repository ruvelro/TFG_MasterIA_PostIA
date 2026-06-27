import { prisma } from "@/lib/db/client";

/** Categorías de error que se monitorizan desde el panel de administración. */
export type ErrorCategory = "auth" | "pipeline" | "server";

export interface LogErrorInput {
  category: ErrorCategory;
  message: string;
  /** Detalle adicional (etapa, runId, stack…). Se trunca para no almacenar datos enormes. */
  detail?: string;
  userId?: string;
}

const MAX_MESSAGE = 1000;
const MAX_DETAIL = 4000;

/**
 * Registra un error en el log unificado. Es BEST-EFFORT: si la propia escritura falla, se traga
 * el error (nunca debe tumbar el flujo que ya estaba fallando). Por eso no devuelve nada útil ni
 * se debe `await` de forma bloqueante en caminos críticos.
 */
export async function logError(input: LogErrorInput): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: {
        category: input.category,
        message: input.message.slice(0, MAX_MESSAGE),
        detail: input.detail ? input.detail.slice(0, MAX_DETAIL) : null,
        userId: input.userId ?? null,
      },
    });
  } catch {
    // Best-effort: registrar el error no debe propagar un fallo nuevo.
  }
}
