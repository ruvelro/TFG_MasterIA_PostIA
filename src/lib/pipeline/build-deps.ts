import type { z } from "zod";

import { runObjectGeneration, runTextGeneration } from "@/lib/ai/generate";
import { resolveStepConfig, type StepOverride } from "@/lib/ai/resolve-step";
import { AI_STAGE_IDS, type AiStageId, type StepConfig } from "@/lib/pipeline/default-config";
import { createFakePipelineDeps } from "@/lib/pipeline/fake-deps";
import { styleProfileToText } from "@/lib/pipeline/format";
import type { PipelineDeps, ResolvedPipelineConfig } from "@/lib/pipeline/types";
import { createSearchProvider } from "@/lib/search";
import { fetchReadableText } from "@/lib/search/fetch-content";
import { getGenerationConfig } from "@/lib/settings/generation-config";
import { getOpenRouterApiKey, getSearchConfig } from "@/lib/settings/integrations";
import { getAllStepConfigs } from "@/lib/settings/pipeline-config";

/**
 * Resuelve la configuración efectiva de la generación combinando: valores por defecto,
 * configuración guardada por el admin y overrides puntuales de esta generación.
 */
export async function buildPipelineConfig(
  overrides?: Partial<Record<AiStageId, StepOverride>>,
): Promise<ResolvedPipelineConfig> {
  const [stored, generation] = await Promise.all([getAllStepConfigs(), getGenerationConfig()]);

  const steps = {} as Record<AiStageId, StepConfig>;
  for (const stageId of AI_STAGE_IDS) {
    steps[stageId] = resolveStepConfig(stageId, stored[stageId], overrides?.[stageId]);
  }

  return {
    steps,
    // La identidad editorial se renderiza a texto para los prompts; SEO y GEO viajan aparte
    // por ser la palanca de optimización (cada prompt los inyecta donde corresponde).
    editorialVoice: styleProfileToText(generation.styleProfile),
    seoRules: generation.styleProfile.seoRules,
    geoRules: generation.styleProfile.geoRules,
    sourceCount: generation.sourceCount,
    maxFixIterations: generation.maxFixIterations,
    maxHumanizeRetries: generation.maxHumanizeRetries,
    aiScoreThreshold: generation.aiScoreThreshold,
    scrubPatterns: generation.scrubPatterns,
  };
}

/**
 * Construye las dependencias REALES del pipeline, enlazadas con la clave de OpenRouter
 * (que queda capturada en el cierre, no circula por el contexto) y el proveedor de búsqueda
 * activo. Falla pronto y con un mensaje claro si no hay clave configurada.
 */
export async function buildPipelineDeps(): Promise<PipelineDeps> {
  // Seam de test: en e2e usamos dependencias falsas deterministas (sin red ni clave), lo
  // que permite probar el flujo completo de la UI sin configurar claves reales.
  if (process.env.E2E === "true") {
    return createFakePipelineDeps();
  }

  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("Falta la clave de OpenRouter. Configúrala en el panel de administración.");
  }

  const searchProvider = createSearchProvider(await getSearchConfig());

  return {
    runText: ({ modelId, prompt }) => runTextGeneration({ apiKey, modelId, prompt }),
    runObject: <T>(params: { modelId: string; prompt: string; schema: z.ZodType<T> }) =>
      runObjectGeneration<T>({
        apiKey,
        modelId: params.modelId,
        prompt: params.prompt,
        schema: params.schema,
      }),
    search: (query, limit) => searchProvider.search(query, limit),
    fetchContent: (url) => fetchReadableText(url),
  };
}
