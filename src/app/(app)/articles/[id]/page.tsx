import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArticleEnrichmentView } from "@/components/article-enrichment";
import { Markdown } from "@/components/markdown";
import { getArticleForUser } from "@/lib/articles/repository";
import { getCurrentSession } from "@/lib/auth/session";
import { ArticleEnrichmentSchema, type ArticleEnrichment } from "@/lib/pipeline/schemas";
import { getWordPressConfig } from "@/lib/settings/integrations";

import { DeleteArticleButton } from "../delete-article-button";
import { GenerationTrace } from "../generation-trace";
import { PublishPanel } from "../publish-panel";
import { ReviseArticle } from "../revise-article";
import { VersionDiff } from "../version-diff";

// Las keywords se guardan como JSON; parseamos de forma defensiva (nunca debe romper la vista).
function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// El enriquecimiento se guarda serializado en `metadataJson`. Se valida con Zod para tolerar
// artículos antiguos (sin metadatos) o esquemas que pudieran haber cambiado: si no encaja,
// simplemente no se muestra el panel en lugar de romper la vista.
function parseEnrichment(raw: string | null): ArticleEnrichment | null {
  if (!raw) return null;
  try {
    const result = ArticleEnrichmentSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
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
  const enrichment = parseEnrichment(article.metadataJson);
  // Solo se ofrece publicar si la integración con WordPress está completa (config del admin).
  const wordpressConfigured = (await getWordPressConfig()) !== null;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <Link href="/articles" className="text-primary text-sm font-medium">
        ← Volver al historial
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="border-muted/15 hover:border-primary/40 bg-foreground/[0.02] text-muted flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors">
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

      {article.featuredImagePath ? (
        // eslint-disable-next-line @next/next/no-img-element -- la sirve un route handler con auth; next/image no aporta aquí
        <img
          src={`/api/articles/${article.id}/image`}
          alt={enrichment?.imageAlt[0] ?? article.title}
          className="border-muted/15 w-full rounded-lg border object-cover"
        />
      ) : null}

      <GenerationTrace steps={article.run?.steps ?? []} />

      {enrichment ? <ArticleEnrichmentView enrichment={enrichment} /> : null}

      <div className="border-muted/15 bg-foreground/[0.02] rounded-lg border p-6">
        <Markdown>{article.contentMarkdown}</Markdown>
      </div>

      <PublishPanel articleId={article.id} wordpressConfigured={wordpressConfigured} />

      <VersionDiff
        parent={article.parent}
        currentMarkdown={article.contentMarkdown}
        revisions={article.children}
      />

      <ReviseArticle articleId={article.id} />

      <div>
        <DeleteArticleButton
          articleId={article.id}
          className="border-muted/30 rounded-md border px-3 py-1.5 text-sm font-medium text-red-600"
        />
      </div>
    </article>
  );
}
