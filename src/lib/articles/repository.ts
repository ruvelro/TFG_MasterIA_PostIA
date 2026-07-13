import { prisma } from "@/lib/db/client";

/**
 * Acceso a datos de los artículos. La **propiedad se fuerza siempre en el `where`**
 * (`userId`), de modo que un usuario nunca puede leer ni borrar artículos de otro, aunque
 * adivine el id. Aislar las consultas aquí las hace testeables y evita repetir el filtro.
 */

/** Artículos del usuario para el listado, del más reciente al más antiguo. */
export function listArticlesByUser(userId: string) {
  return prisma.article.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, metaDescription: true, createdAt: true },
  });
}

/**
 * Artículo del usuario con la traza de su ejecución (etapas) para el detalle. Devuelve
 * `null` si no existe o no pertenece al usuario.
 */
export function getArticleForUser(articleId: string, userId: string) {
  return prisma.article.findFirst({
    where: { id: articleId, userId },
    include: {
      run: { include: { steps: { orderBy: { createdAt: "asc" } } } },
      // Versionado: el padre (para la vista de diferencias) y las revisiones posteriores.
      parent: { select: { id: true, title: true, contentMarkdown: true, createdAt: true } },
      children: {
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Borra el artículo del usuario. Devuelve true si se borró algo (false si no era suyo). */
export async function deleteArticleForUser(articleId: string, userId: string): Promise<boolean> {
  const result = await prisma.article.deleteMany({ where: { id: articleId, userId } });
  return result.count > 0;
}

/**
 * Fija la imagen destacada del artículo. `userId` va en el `where` como defensa en profundidad:
 * solo el propietario puede cambiarla. Devuelve true si se actualizó (false si no era suyo).
 */
export async function setArticleFeaturedImage(
  articleId: string,
  userId: string,
  featuredImagePath: string,
): Promise<boolean> {
  const result = await prisma.article.updateMany({
    where: { id: articleId, userId },
    data: { featuredImagePath },
  });
  return result.count > 0;
}
