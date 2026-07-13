import { prisma } from "@/lib/db/client";

/**
 * Acceso a datos de las imágenes del generador independiente. Igual que en artículos, la
 * **propiedad se fuerza siempre en el `where`** (`userId`): un usuario nunca ve ni borra
 * imágenes de otro aunque adivine el id.
 */

/** Imágenes del usuario para la galería, de la más reciente a la más antigua. */
export function listImagesByUser(userId: string) {
  return prisma.generatedImage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      prompt: true,
      styleId: true,
      model: true,
      mediaType: true,
      createdAt: true,
    },
  });
}

/** Imagen del usuario (con la ruta del fichero) o `null` si no existe o no es suya. */
export function getImageForUser(imageId: string, userId: string) {
  return prisma.generatedImage.findFirst({ where: { id: imageId, userId } });
}

/** Crea una fila de imagen generada. */
export function createGeneratedImage(data: {
  userId: string;
  prompt: string;
  styleId: string | null;
  model: string;
  path: string;
  mediaType: string;
}) {
  return prisma.generatedImage.create({ data });
}

/** Fija la ruta del fichero una vez escrito (el nombre depende del id, que solo existe tras crear). */
export function setGeneratedImagePath(imageId: string, path: string) {
  return prisma.generatedImage.update({ where: { id: imageId }, data: { path } });
}

/**
 * Borra la imagen del usuario. Devuelve la ruta del fichero a eliminar (para que el llamador
 * borre el binario), o `null` si no era suya o no existía.
 */
export async function deleteImageForUser(imageId: string, userId: string): Promise<string | null> {
  const image = await prisma.generatedImage.findFirst({
    where: { id: imageId, userId },
    select: { path: true },
  });
  if (!image) return null;
  await prisma.generatedImage.delete({ where: { id: imageId } });
  return image.path;
}
