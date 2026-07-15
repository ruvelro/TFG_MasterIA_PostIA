import { prisma } from "@/lib/db/client";
import type { PipelineSource } from "@/lib/pipeline/types";

/**
 * Acceso a datos de las fuentes de investigación de un run. Se guardan normalizadas (no en
 * `GenerationRun.contextJson`) porque su contenido descargado pesa demasiado para replicarlo
 * en cada snapshot del contexto. Aislar las consultas aquí evita repetir el mapeo y mantiene
 * el orquestador centrado en la lógica del pipeline.
 */

/** Persiste las fuentes descargadas de un run tras la etapa research. */
export async function saveSources(runId: string, sources: PipelineSource[]): Promise<void> {
  if (sources.length === 0) return;
  await prisma.generationSource.createMany({
    data: sources.map((source) => ({
      runId,
      url: source.url,
      title: source.title,
      snippet: source.snippet,
      content: source.content,
      userProvided: source.userProvided ?? false,
      suspicious: source.suspicious ?? false,
    })),
  });
}

/** Recupera las fuentes de un run (con su contenido) para rehidratar el contexto al reanudar. */
export async function getSourcesByRun(runId: string): Promise<PipelineSource[]> {
  const rows = await prisma.generationSource.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
    select: {
      url: true,
      title: true,
      snippet: true,
      content: true,
      userProvided: true,
      suspicious: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    userProvided: row.userProvided || undefined,
    suspicious: row.suspicious || undefined,
  }));
}
