// Descarga el contenido de una URL y lo reduce a texto legible, para que la etapa research
// pueda usar el cuerpo de las webs como fuente de verdad.
//
// Seguridad: descargar URLs arbitrarias en el servidor es un riesgo de SSRF. Aplicamos un
// guard que solo permite http/https y bloquea hosts internos/privados, además de timeout y
// límite de tamaño. Es defensa razonable (no cubre rebinding de DNS, fuera de alcance del TFG).

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000; // 2 MB: suficiente para el texto de un artículo, acota memoria.

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** Lanza si la URL no es segura para descargar desde el servidor (guard anti-SSRF). */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http(s)");
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (isPrivate) {
    throw new Error("No se permite descargar recursos de hosts internos");
  }

  return url;
}

/** Convierte HTML en texto plano: elimina script/style, quita etiquetas y colapsa espacios. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchReadableText(rawUrl: string): Promise<string> {
  assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "PostIA/1.0 (+research)" },
    });
    if (!response.ok) {
      throw new Error(`La descarga falló (${response.status})`);
    }
    const html = (await response.text()).slice(0, MAX_BYTES);
    return htmlToText(html);
  } finally {
    clearTimeout(timeout);
  }
}
