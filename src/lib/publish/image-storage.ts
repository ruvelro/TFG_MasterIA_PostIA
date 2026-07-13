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

/** Extensión de fichero para un tipo MIME de imagen (png por defecto si es desconocido). */
export function extensionForMediaType(mediaType: string): string {
  return EXTENSION_BY_MIME[mediaType] ?? "png";
}

/** Persiste una imagen destacada desde su binario y devuelve la ruta RELATIVA. */
export async function storeFeaturedImageBuffer(params: {
  /** Nombre base del fichero (sin extensión): el runId o el articleId según el origen. */
  basename: string;
  data: Buffer;
  mediaType: string;
}): Promise<string> {
  const relativePath = join(
    FEATURED_DIR,
    `${params.basename}.${extensionForMediaType(params.mediaType)}`,
  );
  await mkdir(FEATURED_DIR, { recursive: true });
  await writeFile(relativePath, params.data);
  return relativePath;
}

/** Persiste una imagen generada y devuelve su ruta RELATIVA (la que se guarda en Article). */
export async function storeFeaturedImage(params: {
  runId: string;
  imageBase64: string;
  mediaType: string;
}): Promise<string> {
  return storeFeaturedImageBuffer({
    basename: params.runId,
    data: Buffer.from(params.imageBase64, "base64"),
    mediaType: params.mediaType,
  });
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
