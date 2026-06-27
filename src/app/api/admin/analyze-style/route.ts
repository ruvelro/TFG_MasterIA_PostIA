import type { NextRequest } from "next/server";
import type { z } from "zod";

import { runObjectGeneration, runTextGeneration } from "@/lib/ai/generate";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/auth/authorize";
import { streamJsonEvents } from "@/lib/http/event-stream";
import { logError } from "@/lib/observability/error-log";
import type { StyleAnalysisResult } from "@/lib/pipeline/schemas";
import { fetchReadableText } from "@/lib/search/fetch-content";
import { getStyleAnalyzerModel } from "@/lib/settings/generation-config";
import { getOpenRouterApiKey } from "@/lib/settings/integrations";
import { analyzeEditorialStyle, type AnalyzerProgress } from "@/lib/settings/style-analyzer";
import { analyzeStyleSchema } from "@/lib/validation/style";

// Descarga URLs y llama a la IA: runtime Node y siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Eventos que viajan por el stream NDJSON del analizador hacia el formulario de admin. */
export type StyleAnalysisEvent =
  | ({ type: "progress" } & AnalyzerProgress)
  | { type: "result"; profile: StyleAnalysisResult }
  | { type: "error"; message: string };

/**
 * Entrena el perfil de estilo a partir de un conjunto de URLs. Solo admin. Transmite el
 * progreso (descarga, análisis por lotes, consolidación) en NDJSON, porque con muchas URLs
 * el proceso es largo y conviene mostrar avance en vez de una espera opaca.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      return new Response("No autenticado", { status: 401 });
    if (error instanceof ForbiddenError) return new Response("No autorizado", { status: 403 });
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = analyzeStyleSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    return new Response("Falta la clave de OpenRouter. Configúrala antes de entrenar.", {
      status: 400,
    });
  }
  const model = await getStyleAnalyzerModel();

  return streamJsonEvents<StyleAnalysisEvent>(async (emit) => {
    try {
      const profile = await analyzeEditorialStyle({
        urls: parsed.data.urls,
        model,
        deps: {
          fetchContent: (url) => fetchReadableText(url),
          runText: ({ modelId, prompt }) => runTextGeneration({ apiKey, modelId, prompt }),
          runObject: <T>(p: { modelId: string; prompt: string; schema: z.ZodType<T> }) =>
            runObjectGeneration<T>({
              apiKey,
              modelId: p.modelId,
              prompt: p.prompt,
              schema: p.schema,
            }),
        },
        onProgress: (progress) => emit({ type: "progress", ...progress }),
      });
      emit({ type: "result", profile });
    } catch (error) {
      // Registramos el fallo (modelo/IA o descarga) para el panel y lo re-lanzamos: el stream lo
      // convierte en un evento de error para el cliente.
      await logError({
        category: "server",
        message: `Análisis de estilo fallido: ${error instanceof Error ? error.message : String(error)}`,
        detail: `modelo: ${model}`,
      });
      throw error;
    }
  });
}
