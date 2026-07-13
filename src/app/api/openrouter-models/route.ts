import { getOpenRouterModels } from "@/lib/ai/openrouter-models";
import { requireSession, UnauthenticatedError } from "@/lib/auth/authorize";

// Sale a la red (OpenRouter): runtime Node y siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve el catálogo de modelos de OpenRouter para poblar los desplegables de modelo (panel de
 * admin y generador de imágenes). Requiere sesión: el catálogo es público, pero la ruta vive tras
 * autenticación para no exponer un proxy abierto. La respuesta se cachea en el servidor (ver
 * `getOpenRouterModels`), así que abrir estas páginas repetidamente no machaca a OpenRouter.
 */
export async function GET(): Promise<Response> {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      return new Response("No autenticado", { status: 401 });
    throw error;
  }

  const models = await getOpenRouterModels();
  return Response.json({ models }, { headers: { "Cache-Control": "private, max-age=300" } });
}
