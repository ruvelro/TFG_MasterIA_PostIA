"use client";

import { deleteArticle } from "./actions";

// Botón de borrado reutilizable (lista y detalle). Pide confirmación antes de enviar la
// Server Action; si el usuario cancela, se evita el envío.
export function DeleteArticleButton({
  articleId,
  className,
}: {
  articleId: string;
  className?: string;
}) {
  return (
    <form
      action={deleteArticle}
      onSubmit={(event) => {
        if (!window.confirm("¿Eliminar este artículo? Esta acción no se puede deshacer.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="articleId" value={articleId} />
      <button type="submit" className={className ?? "text-sm font-medium text-red-600"}>
        Eliminar
      </button>
    </form>
  );
}
