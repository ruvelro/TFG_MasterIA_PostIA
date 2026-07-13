import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";

import { extensionForMediaType } from "@/lib/publish/image-storage";

/**
 * Almacenamiento en disco de las imágenes del generador independiente (galería por usuario).
 *
 * Viven FUERA de `public/` porque son privadas: se sirven por un route handler que verifica
 * sesión y propiedad. Se separan por usuario en subdirectorios para que un id nunca colisione
 * entre cuentas. En Docker, `uploads` es un volumen persistente.
 */
const UPLOADS_DIR = "uploads";
const GENERATED_DIR = join(UPLOADS_DIR, "generated");

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Persiste una imagen de galería y devuelve su ruta RELATIVA (la que se guarda en BD). */
export async function storeGeneratedImage(params: {
  userId: string;
  imageId: string;
  imageBase64: string;
  mediaType: string;
}): Promise<string> {
  const dir = join(GENERATED_DIR, params.userId);
  const relativePath = join(dir, `${params.imageId}.${extensionForMediaType(params.mediaType)}`);
  await mkdir(dir, { recursive: true });
  await writeFile(relativePath, Buffer.from(params.imageBase64, "base64"));
  return relativePath;
}

/** Comprueba que una ruta guardada cae dentro del directorio de generadas (defensa ante manipulación). */
function assertSafe(relativePath: string): string {
  const safePath = normalize(relativePath);
  if (safePath.startsWith("..") || !safePath.startsWith(GENERATED_DIR)) {
    throw new Error("Ruta de imagen inválida");
  }
  return safePath;
}

/** Lee una imagen de galería por su ruta relativa, devolviendo binario y tipo MIME. */
export async function readGeneratedImage(
  relativePath: string,
): Promise<{ data: Buffer; mediaType: string }> {
  const safePath = assertSafe(relativePath);
  const extension = safePath.split(".").pop() ?? "";
  return {
    data: await readFile(safePath),
    mediaType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
  };
}

/** Borra el fichero de una imagen de galería. Es best-effort: si ya no existe, no lanza. */
export async function deleteGeneratedImageFile(relativePath: string): Promise<void> {
  try {
    await unlink(assertSafe(relativePath));
  } catch {
    // El fichero pudo borrarse ya (volumen recreado, etc.); la fila de BD manda.
  }
}
