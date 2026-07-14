import { prisma } from "@/lib/db/client";
import { indexArticleAndSuggestLinks } from "@/lib/embeddings/service";
import { checkDailyBudget } from "@/lib/observability/cost-budget";
import { logError } from "@/lib/observability/error-log";
import { startGeneration } from "@/lib/pipeline/orchestrator";
import type { NewsType } from "@/lib/pipeline/schemas";
import type { PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";

/**
 * Worker de lotes: procesa los temas de un lote en segundo plano, cada uno como una
 * generación completa SIN pausas de revisión (los artículos resultantes quedan como
 * borradores del usuario, pendientes de revisión humana en el historial).
 *
 * El procesamiento es SECUENCIAL a propósito: procesar en paralelo dispararía los límites
 * de tasa del proveedor de IA y abriría carreras en el control de presupuesto. La app se
 * despliega como servidor Node de larga vida (Docker), así que un bucle asíncrono
 * lanzado con fire-and-forget desde el route handler es suficiente; en un despliegue
 * serverless haría falta una cola externa.
 */

export interface CreateBatchInput {
  userId: string;
  name: string;
  topics: string[];
  /** Presupuesto máximo del lote en USD (0 = sin límite). */
  budgetUsd: number;
  newsTypeId?: string;
}

/** Crea el lote con todos sus temas en estado pending. No arranca el procesamiento. */
export async function createBatch(input: CreateBatchInput): Promise<string> {
  const batch = await prisma.batch.create({
    data: {
      userId: input.userId,
      name: input.name,
      budgetUsd: input.budgetUsd,
      newsTypeId: input.newsTypeId ?? null,
      items: { create: input.topics.map((topic) => ({ topic })) },
    },
    select: { id: true },
  });
  return batch.id;
}

export interface BatchProcessingDeps {
  cfg: ResolvedPipelineConfig;
  deps: PipelineDeps;
  /** Tipo de noticia resuelto con el que se generan todos los temas del lote. */
  newsType?: NewsType;
}

/** Marca todos los items pendientes como skipped con un motivo (presupuesto, cancelación…). */
async function skipPendingItems(batchId: string, reason: string): Promise<void> {
  await prisma.batchItem.updateMany({
    where: { batchId, status: "pending" },
    data: { status: "skipped", error: reason },
  });
}

/** Coste ya consumido por el lote (suma de los costes congelados en sus items). */
async function batchSpentUsd(batchId: string): Promise<number> {
  const total = await prisma.batchItem.aggregate({
    _sum: { costUsd: true },
    where: { batchId },
  });
  return total._sum.costUsd ?? 0;
}

/**
 * Procesa un lote hasta agotarlo (o hasta que se cancele o se agote el presupuesto).
 * Un tema fallido no interrumpe el resto: se registra en el item y se continúa.
 */
export async function processBatch(
  batchId: string,
  processing: BatchProcessingDeps,
): Promise<void> {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status === "cancelled" || batch.status === "completed") return;

  await prisma.batch.update({ where: { id: batchId }, data: { status: "running" } });

  for (;;) {
    // El estado se relee en cada vuelta: la cancelación del usuario debe surtir efecto
    // entre item e item (no se aborta la generación en curso, que ya tiene su coste).
    const current = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    if (current.status === "cancelled") {
      await skipPendingItems(batchId, "Lote cancelado por el usuario");
      return;
    }

    // Presupuesto del lote (congelado por item) y presupuesto diario del usuario (A6).
    if (current.budgetUsd > 0 && (await batchSpentUsd(batchId)) >= current.budgetUsd) {
      await skipPendingItems(batchId, "Presupuesto del lote agotado");
      break;
    }
    const daily = await checkDailyBudget(batch.userId);
    if (!daily.allowed) {
      await skipPendingItems(batchId, "Presupuesto diario del usuario agotado");
      break;
    }

    const item = await prisma.batchItem.findFirst({
      where: { batchId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!item) break;

    await prisma.batchItem.update({ where: { id: item.id }, data: { status: "running" } });
    try {
      const result = await startGeneration({
        userId: batch.userId,
        topic: item.topic,
        // Sin pausas: el lote es desatendido; la revisión humana ocurre sobre el borrador.
        pauseForReview: false,
        newsType: processing.newsType,
        cfg: processing.cfg,
        deps: processing.deps,
      });

      // Congela el coste del run en el item para el control de presupuesto del lote.
      const cost = await prisma.generationStep.aggregate({
        _sum: { costUsd: true },
        where: { runId: result.runId },
      });
      await prisma.batchItem.update({
        where: { id: item.id },
        data: {
          status: "completed",
          runId: result.runId,
          articleId: result.articleId ?? null,
          costUsd: cost._sum.costUsd ?? 0,
        },
      });
      // Indexado para dedupe/enlazado interno (best-effort; no espera al resultado).
      if (result.status === "completed" && result.articleId) {
        void indexArticleAndSuggestLinks(result.articleId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.batchItem.update({
        where: { id: item.id },
        data: { status: "failed", error: message },
      });
      await logError({
        category: "pipeline",
        message: `Fallo en un tema del lote "${batch.name}": ${message}`,
        detail: `batchId: ${batchId} · tema: ${item.topic}`,
      });
    }
  }

  await prisma.batch.update({ where: { id: batchId }, data: { status: "completed" } });
}

/** Lotes del usuario con sus items, del más reciente al más antiguo (para la vista). */
export function getBatchesForUser(userId: string) {
  return prisma.batch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
}
