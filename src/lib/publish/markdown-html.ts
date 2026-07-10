import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Convierte el Markdown de un artículo a HTML SANEADO, para la exportación y la publicación
 * en WordPress. Usa el mismo ecosistema (remark/rehype) y el mismo saneado (rehype-sanitize)
 * que el visor de la app (`react-markdown`), de modo que lo que se exporta coincide con lo
 * que se previsualiza y ningún HTML peligroso viaja al exterior.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
