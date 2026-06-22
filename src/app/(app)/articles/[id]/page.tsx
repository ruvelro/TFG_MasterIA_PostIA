import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { getArticleForUser } from "@/lib/articles/repository";
import { getCurrentSession } from "@/lib/auth/session";

import { DeleteArticleButton } from "../delete-article-button";
import { GenerationTrace } from "../generation-trace";

// Las keywords se guardan como JSON; parseamos de forma defensiva (nunca debe romper la vista).
function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  // El filtro por usuario está en el repositorio: un artículo ajeno devuelve null → 404.
  const article = await getArticleForUser(id, session.user.id);
  if (!article) notFound();

  const keywords = parseKeywords(article.keywords);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <Link href="/articles" className="text-primary text-sm font-medium">
        ← Volver al historial
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="border-muted/20 text-muted flex flex-col gap-1 rounded-md border p-3 text-sm">
          <p>
            <span className="font-medium">Slug:</span> {article.slug}
          </p>
          <p>
            <span className="font-medium">Meta description:</span> {article.metaDescription}
          </p>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Keywords:</span>
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <GenerationTrace steps={article.run?.steps ?? []} />

      <div className="border-muted/20 rounded-lg border p-6">
        <Markdown>{article.contentMarkdown}</Markdown>
      </div>

      <div>
        <DeleteArticleButton
          articleId={article.id}
          className="border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium text-red-600"
        />
      </div>
    </article>
  );
}
