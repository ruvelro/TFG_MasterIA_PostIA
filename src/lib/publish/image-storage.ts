import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";

/**
 * Almacenamiento en disco de las imágenes destacadas generadas por la etapa feature-image.
 *
 * Las imágenes viven FUERA de `public/` a propósito: son contenido privado de cada usuario
 * y se sirven a través de un route handler que verifica sesión y propiedad. En despliegues
 * con Docker el directorio debe montarse como volumen (igual que la BD SQLite).
 */
const UPLOADS_DIR = "uploads";
const FEATURED_DIR = join(UPLOADS_DIR, "featured");

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Persiste una imagen generada y devuelve su ruta RELATIVA (la que se guarda en Article). */
export async function storeFeaturedImage(params: {
  runId: string;
  imageBase64: string;
  mediaType: string;
}): Promise<string> {
  const extension = EXTENSION_BY_MIME[params.mediaType] ?? "png";
  const relativePath = join(FEATURED_DIR, `${params.runId}.${extension}`);
  await mkdir(FEATURED_DIR, { recursive: true });
  await writeFile(relativePath, Buffer.from(params.imageBase64, "base64"));
  return relativePath;
}

/**
 * Lee una imagen destacada por su ruta relativa guardada en `Article`. Rechaza rutas fuera
 * del directorio de uploads (defensa ante una ruta manipulada en la BD).
 */
export async function readFeaturedImage(
  relativePath: string,
): Promise<{ data: Buffer; mediaType: string }> {
  const safePath = normalize(relativePath);
  if (safePath.startsWith("..") || !safePath.startsWith(FEATURED_DIR)) {
    throw new Error("Ruta de imagen inválida");
  }
  const extension = safePath.split(".").pop() ?? "";
  return {
    data: await readFile(safePath),
    mediaType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
  };
}
