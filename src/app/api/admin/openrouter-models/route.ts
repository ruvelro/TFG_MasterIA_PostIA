import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/auth/authorize";
import { getOpenRouterModels } from "@/lib/ai/openrouter-models";

// Sale a la red (OpenRouter): runtime Node y siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve el catálogo de modelos de OpenRouter para poblar el desplegable del panel de admin.
 * Solo admin: aunque el catálogo sea público, la ruta vive tras autenticación para no exponer
 * un proxy abierto ni superficie innecesaria. La respuesta se cachea en el servidor (ver
 * `getOpenRouterModels`), así que abrir el panel repetidamente no machaca a OpenRouter.
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      return new Response("No autenticado", { status: 401 });
    if (error instanceof ForbiddenError) return new Response("No autorizado", { status: 403 });
    throw error;
  }

  const models = await getOpenRouterModels();
  return Response.json({ models }, { headers: { "Cache-Control": "private, max-age=300" } });
}
