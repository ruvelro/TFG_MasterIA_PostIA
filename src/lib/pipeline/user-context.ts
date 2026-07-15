/** Extrae URLs HTTP(S) únicas del contexto adicional, sin arrastrar puntuación de la frase. */
export function extractUserContextUrls(context?: string): string[] {
  const matches = context?.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  const urls = new Map<string, string>();

  for (const match of matches) {
    const candidate = match.replace(/[),.;:!?\]}]+$/g, "");
    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      const normalized = url.toString();
      if (!urls.has(normalized)) urls.set(normalized, normalized);
    } catch {
      // Un fragmento con aspecto de URL pero sintaxis inválida sigue viajando como texto.
    }
  }

  return [...urls.values()];
}
