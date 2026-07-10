import type { z } from "zod";

import { runObjectGeneration, runTextGeneration } from "@/lib/ai/generate";
import { estimateCostUsd, findModelPrice, getModelPricing } from "@/lib/ai/pricing";
import {
  assertOverrideModelsAllowed,
  resolveStepConfig,
  type StepOverride,
} from "@/lib/ai/resolve-step";
import { logError } from "@/lib/observability/error-log";
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

  // Allowlist de modelos: solo los que el admin tiene configurados por etapa (cada uno cae a su
  // default si no hay fila). Rechazamos cualquier override que apunte a un modelo fuera de aquí,
  // para que un usuario no pueda fijar por API un modelo caro a costa de la clave compartida.
  const allowedModels = new Set(AI_STAGE_IDS.map((id) => stored[id].model));
  assertOverrideModelsAllowed(overrides, allowedModels);

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
    queryExpansionModel: generation.queryExpansionModel,
    maxFixIterations: generation.maxFixIterations,
    maxHumanizeRetries: generation.maxHumanizeRetries,
    aiScoreThreshold: generation.aiScoreThreshold,
    scrubPatterns: generation.scrubPatterns,
    forbiddenWords: generation.styleProfile.forbiddenWords,
    validatorConfig: generation.validatorConfig,
  };
}

/**
 * Construye las dependencias REALES del pipeline, enlazadas con la clave de OpenRouter
 * (que queda capturada en el cierre, no circula por el contexto) y el proveedor de búsqueda
 * activo. Falla pronto y con un mensaje claro si no hay clave configurada.
 */
export async function buildPipelineDeps(signal?: AbortSignal): Promise<PipelineDeps> {
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

  // Resiliencia de IA configurable por el admin (reintentos y timeout por llamada). Se lee aquí,
  // al construir las deps, y se captura en el cierre para que todas las etapas la respeten.
  const { aiMaxRetries, aiTimeoutMs } = await getGenerationConfig();

  // Modelos ya avisados por no tener precio en el catálogo. Dedupe por generación: el pipeline
  // encadena ~11 etapas que pueden compartir modelo, y no queremos 11 entradas idénticas en el log.
  const warnedMissingPrice = new Set<string>();

  // La señal se captura en el cierre: cualquier llamada de IA en curso se aborta si el cliente
  // cancela, evitando malgastar tokens. La siguiente etapa tampoco arranca (lanza al abortar).
  return {
    runText: ({ modelId, prompt }) =>
      runTextGeneration({
        apiKey,
        modelId,
        prompt,
        abortSignal: signal,
        maxRetries: aiMaxRetries,
        timeoutMs: aiTimeoutMs,
      }),
    runObject: <T>(params: { modelId: string; prompt: string; schema: z.ZodType<T> }) =>
      runObjectGeneration<T>({
        apiKey,
        modelId: params.modelId,
        prompt: params.prompt,
        schema: params.schema,
        abortSignal: signal,
        maxRetries: aiMaxRetries,
        timeoutMs: aiTimeoutMs,
      }),
    search: (query, limit, options) => searchProvider.search(query, limit, options),
    fetchContent: (url) => fetchReadableText(url),
    // El catálogo de precios se cachea en pricing.ts, así que estas llamadas no golpean la red
    // en cada etapa. Best-effort: si no hay precio, el coste de esa etapa queda como null.
    estimateCost: async (model, inputTokens, outputTokens) => {
      const pricing = await getModelPricing();
      // Convertimos el null silencioso en señal: si la etapa tiene modelo pero no figura en el
      // catálogo (ni por id exacto ni normalizado), lo registramos una vez para poder corregir
      // la configuración. Con catálogo vacío (red caída / e2e) no avisamos: no es del modelo.
      if (
        model &&
        pricing.size > 0 &&
        !findModelPrice(pricing, model) &&
        !warnedMissingPrice.has(model)
      ) {
        warnedMissingPrice.add(model);
        void logError({
          category: "pipeline",
          message: `Modelo sin precio en el catálogo de OpenRouter: ${model}`,
          detail: "El coste de las etapas con este modelo no se podrá estimar (quedará como null).",
        });
      }
      return estimateCostUsd(pricing, model, inputTokens, outputTokens);
    },
  };
}
