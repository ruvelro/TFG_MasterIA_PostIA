import Link from "next/link";
import { redirect } from "next/navigation";

import { listArticlesByUser } from "@/lib/articles/repository";
import { getCurrentSession } from "@/lib/auth/session";

import { DeleteArticleButton } from "./delete-article-button";

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

// Historial: lista los artículos del usuario. La sesión también se verifica aquí (además
// del layout) para disponer del id con el que filtrar.
export default async function ArticlesPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  const articles = await listArticlesByUser(session.user.id);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">Tus artículos</h1>

      {articles.length === 0 ? (
        <p className="text-muted text-sm">
          Aún no has generado ningún artículo.{" "}
          <Link href="/generate" className="text-primary font-medium">
            Generar el primero
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.map((article) => (
            <li
              key={article.id}
              className="border-muted/20 flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0">
                <Link href={`/articles/${article.id}`} className="font-medium hover:underline">
                  {article.title}
                </Link>
                <p className="text-muted mt-1 text-xs">{dateFormatter.format(article.createdAt)}</p>
                <p className="text-muted mt-1 line-clamp-2 text-sm">{article.metaDescription}</p>
              </div>
              <DeleteArticleButton articleId={article.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
