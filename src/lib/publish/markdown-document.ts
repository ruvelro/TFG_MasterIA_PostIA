/**
 * El título se almacena como metadata y no forma parte del cuerpo canónico. Estas utilidades
 * evitan H1 duplicados en HTML/WordPress y garantizan que la descarga Markdown sí sea un
 * documento completo con un único titular.
 */
export function stripLeadingMarkdownTitle(markdown: string): string {
  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1 || !/^#\s+\S/.test(lines[firstContentIndex].trim())) {
    return markdown.trim();
  }

  lines.splice(firstContentIndex, 1);
  return lines.join("\n").trim();
}

export function composeMarkdownDocument(title: string, markdown: string): string {
  const normalizedTitle =
    title
      .replace(/\s+/g, " ")
      .replace(/^#+\s*/, "")
      .trim() || "Artículo";
  const body = stripLeadingMarkdownTitle(markdown);
  return body ? `# ${normalizedTitle}\n\n${body}\n` : `# ${normalizedTitle}\n`;
}
