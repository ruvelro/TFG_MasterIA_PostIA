import { runImageGeneration } from "@/lib/ai/generate";
import { requireSession, UnauthenticatedError } from "@/lib/auth/authorize";
import { createGeneratedImage, setGeneratedImagePath } from "@/lib/images/repository";
import { storeGeneratedImage } from "@/lib/images/storage";
import { generateRateLimiter } from "@/lib/http/rate-limit";
import { logError } from "@/lib/observability/error-log";
import { getImageStyles } from "@/lib/settings/image-styles";
import { getOpenRouterApiKey } from "@/lib/settings/integrations";
import { generateImageSchema } from "@/lib/validation/image";

// Genera una imagen con un modelo de OpenRouter: runtime Node y siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Un modelo de imagen puede tardar; se le da margen por encima del timeout de texto.
const IMAGE_TIMEOUT_MS = 90_000;

/**
 * Generador de imágenes independiente. Cualquier usuario autenticado puede pedir una imagen
 * a partir de un modelo, un prompt y (opcionalmente) un estilo configurado. El sufijo del estilo
 * se resuelve aquí, en el servidor, para no confiar en lo que envíe el cliente. Devuelve la
 * imagen en base64 y el cliente la muestra como `data:` URI (la CSP permite `img-src data:`).
 */
export async function POST(request: Request): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      return new Response("No autenticado", { status: 401 });
    throw error;
  }

  // Generar una imagen tiene coste: se limita por usuario igual que la generación de artículos.
  if (!generateRateLimiter.check(session.user.id)) {
    return Response.json(
      { error: "Demasiadas peticiones, inténtalo en un minuto." },
      { status: 429 },
    );
  }

  const parsed = generateImageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Falta la clave de OpenRouter. Configúrala en el panel de administración." },
      { status: 400 },
    );
  }

  // El sufijo del estilo se busca por id en el catálogo del servidor y se anexa al prompt.
  const styles = await getImageStyles();
  const suffix = parsed.data.styleId
    ? (styles.find((s) => s.id === parsed.data.styleId)?.promptSuffix ?? "")
    : "";
  const prompt = suffix ? `${parsed.data.prompt}\n\nStyle: ${suffix}` : parsed.data.prompt;

  try {
    const image = await runImageGeneration({
      apiKey,
      modelId: parsed.data.model,
      prompt,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });

    // Se persiste para la galería del usuario: primero la fila (obtiene el id) y luego el fichero
    // con ese id como nombre. Se guarda el prompt SIN el sufijo del estilo (lo que el usuario tecleó).
    const row = await createGeneratedImage({
      userId: session.user.id,
      prompt: parsed.data.prompt,
      styleId: parsed.data.styleId ?? null,
      model: parsed.data.model,
      path: "",
      mediaType: image.mediaType,
    });
    const path = await storeGeneratedImage({
      userId: session.user.id,
      imageId: row.id,
      imageBase64: image.imageBase64,
      mediaType: image.mediaType,
    });
    await setGeneratedImagePath(row.id, path);

    return Response.json({
      id: row.id,
      imageBase64: image.imageBase64,
      mediaType: image.mediaType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido generando la imagen";
    await logError({
      category: "server",
      message: "Fallo al generar imagen independiente",
      detail: `modelo=${parsed.data.model} · ${message}`,
      userId: session.user.id,
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
