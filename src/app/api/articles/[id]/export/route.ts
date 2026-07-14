import type { NextRequest } from "next/server";

import { getArticleForUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";
import {
  composeMarkdownDocument,
  stripLeadingMarkdownTitle,
} from "@/lib/publish/markdown-document";
import { markdownToHtml } from "@/lib/publish/markdown-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exporta un artículo del usuario como fichero descargable: Markdown tal cual o HTML
 * saneado (mismo conversor que la publicación). Verifica sesión y propiedad.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/articles/[id]/export">,
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

  const format = request.nextUrl.searchParams.get("format") ?? "md";
  if (format !== "md" && format !== "html") {
    return new Response('Formato no soportado (usa "md" o "html")', { status: 400 });
  }

  if (format === "md") {
    return new Response(composeMarkdownDocument(article.title, article.contentMarkdown), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${article.slug}.md"`,
      },
    });
  }

  // HTML autocontenido mínimo: el cuerpo saneado con el título y la meta description.
  // Título y descripción se escapan a mano (no pasan por el saneador del cuerpo).
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const body = await markdownToHtml(stripLeadingMarkdownTitle(article.contentMarkdown));
  const html = [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(article.title)}</title>`,
    `<meta name="description" content="${escapeHtml(article.metaDescription)}" />`,
    "</head>",
    "<body>",
    `<h1>${escapeHtml(article.title)}</h1>`,
    body,
    "</body>",
    "</html>",
  ].join("\n");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${article.slug}.html"`,
    },
  });
}
