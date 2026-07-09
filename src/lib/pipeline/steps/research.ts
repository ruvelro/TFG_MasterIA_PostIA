import { detectPromptInjection } from "@/lib/pipeline/injection-heuristics";
import type {
  PipelineContext,
  PipelineDeps,
  PipelineSource,
  ResolvedPipelineConfig,
} from "@/lib/pipeline/types";

/**
 * Etapa research (sin IA): busca N fuentes y DESCARGA su contenido, que será la fuente de
 * verdad del artículo. Si la descarga de una fuente falla, no abortamos toda la generación:
 * caemos al extracto de la búsqueda para esa fuente concreta (degradación elegante).
 */
export async function runResearch(
  ctx: PipelineContext,
  cfg: ResolvedPipelineConfig,
  deps: PipelineDeps,
): Promise<PipelineSource[]> {
  const results = await deps.search(ctx.topic, cfg.sourceCount);

  return Promise.all(
    results.map(async (result): Promise<PipelineSource> => {
      try {
        const content = await deps.fetchContent(result.url);
        // Anti-inyección: si el cuerpo trae órdenes dirigidas al modelo, no dejamos que
        // llegue a los prompts; degradamos al extracto de búsqueda y marcamos la fuente
        // como sospechosa para que el prompt de extracción la trate con cautela.
        if (detectPromptInjection(content)) {
          return { ...result, content: result.snippet, suspicious: true };
        }
        return { ...result, content };
      } catch {
        return { ...result, content: result.snippet };
      }
    }),
  );
}
