"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteArticleForUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";

/**
 * Borra un artículo del usuario actual. La propiedad se comprueba en el repositorio (el
 * `where` incluye el `userId`), así que un id ajeno no borra nada. Tras borrar, vuelve al
 * listado (sirve igual desde la lista o desde el detalle).
 */
export async function deleteArticle(formData: FormData): Promise<void> {
  const session = await requireSession();
  const articleId = formData.get("articleId");

  if (typeof articleId === "string" && articleId) {
    await deleteArticleForUser(articleId, session.user.id);
  }

  revalidatePath("/articles");
  redirect("/articles");
}
