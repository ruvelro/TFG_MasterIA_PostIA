import type { NextRequest } from "next/server";
import { z } from "zod";

import { getArticleForUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";
import { stripLeadingMarkdownTitle } from "@/lib/publish/markdown-document";
import { markdownToHtml } from "@/lib/publish/markdown-html";
import { publishToWordPress } from "@/lib/publish/wordpress";
import { ArticleEnrichmentSchema } from "@/lib/pipeline/schemas";
import { getWordPressConfig } from "@/lib/settings/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publishSchema = z.object({
  // "draft" por defecto: el post queda pendiente de revisión humana en WordPress.
  status: z.enum(["draft", "publish"]).default("draft"),
});

/**
 * Publica un artículo del usuario en el WordPress configurado por el admin. Verifica sesión
 * y PROPIEDAD del artículo; usa los metadatos ya generados por el pipeline (tags, Schema.org)
 * y convierte el Markdown a HTML saneado antes de enviarlo.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/articles/[id]/publish">,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("No autenticado", { status: 401 });
  }

  const { id } = await ctx.params;
  const article = await getArticleForUser(id, session.user.id);
  if (!article) {
    return new Response("Artículo no encontrado", { status: 404 });
  }

  const config = await getWordPressConfig();
  if (!config) {
    return new Response(
      "WordPress no está configurado. Un administrador debe completar la integración en /admin.",
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0].message, { status: 400 });
  }

  // El enriquecimiento aporta tags y JSON-LD; puede faltar en artículos antiguos.
  const enrichment = article.metadataJson
    ? ArticleEnrichmentSchema.safeParse(JSON.parse(article.metadataJson))
    : null;

  try {
    const result = await publishToWordPress(config, {
      title: article.title,
      slug: article.slug,
      contentHtml: await markdownToHtml(stripLeadingMarkdownTitle(article.contentMarkdown)),
      excerpt: article.metaDescription,
      tags: enrichment?.success ? enrichment.data.tags : [],
      jsonLd: enrichment?.success
        ? (enrichment.data.jsonLdNewsArticle as Record<string, unknown>)
        : undefined,
      status: parsed.data.status,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al publicar";
    // 502: el fallo viene del WordPress remoto (credenciales, red, validación del post).
    return new Response(message, { status: 502 });
  }
}
