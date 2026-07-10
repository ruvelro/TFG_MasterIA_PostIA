/**
 * Cliente mínimo de la REST API de WordPress para publicar artículos.
 *
 * Autenticación por Application Password (Basic auth), el mecanismo recomendado por
 * WordPress para integraciones sin OAuth. Las credenciales llegan resueltas desde la
 * configuración (la contraseña vive cifrada en la BD, como el resto de secretos).
 * `fetch` es inyectable para testear el cliente sin red.
 */

export interface WordPressConfig {
  /** URL base del sitio, p. ej. https://miblog.com (sin /wp-json). */
  baseUrl: string;
  username: string;
  /** Application Password generada en el perfil del usuario de WordPress. */
  appPassword: string;
}

export interface WordPressPublishInput {
  title: string;
  slug: string;
  /** HTML ya saneado del artículo (ver `markdownToHtml`). */
  contentHtml: string;
  /** Extracto del post (la meta description del artículo). */
  excerpt: string;
  /** Nombres de etiquetas; se crean en WordPress si no existen. */
  tags: string[];
  /** Bloque Schema.org (JSON-LD) que se inyecta como <script> al final del contenido. */
  jsonLd?: Record<string, unknown>;
  /** "draft" (por defecto): el post queda pendiente de revisión humana en WordPress. */
  status: "draft" | "publish";
}

export interface WordPressPublishResult {
  postId: number;
  /** Enlace al post (o a su vista previa si es borrador). */
  link: string;
}

type FetchLike = typeof fetch;

function apiUrl(config: WordPressConfig, path: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}/wp-json/wp/v2${path}`;
}

function authHeader(config: WordPressConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.appPassword}`).toString("base64")}`;
}

async function wpRequest(
  config: WordPressConfig,
  path: string,
  body: Record<string, unknown>,
  fetchFn: FetchLike,
): Promise<{ status: number; json: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetchFn(apiUrl(config, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(config),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`No se pudo conectar con WordPress (${config.baseUrl})`);
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

/**
 * Resuelve los nombres de etiquetas a ids de término de WordPress, creándolas si hace
 * falta. La API devuelve `term_exists` (400) cuando la etiqueta ya existe, con el id del
 * término existente en `data.term_id`: se aprovecha ese id en lugar de tratarlo como error.
 */
export async function ensureTagIds(
  config: WordPressConfig,
  names: string[],
  fetchFn: FetchLike = fetch,
): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    const { status, json } = await wpRequest(config, "/tags", { name: trimmed }, fetchFn);
    if (status === 201 && typeof json.id === "number") {
      ids.push(json.id);
      continue;
    }
    const data = json.data as { term_id?: number } | undefined;
    if (json.code === "term_exists" && typeof data?.term_id === "number") {
      ids.push(data.term_id);
      continue;
    }
    throw new Error(`WordPress rechazó la etiqueta "${trimmed}" (HTTP ${status})`);
  }
  return ids;
}

/** Publica (o guarda como borrador) un artículo en WordPress y devuelve el enlace al post. */
export async function publishToWordPress(
  config: WordPressConfig,
  input: WordPressPublishInput,
  fetchFn: FetchLike = fetch,
): Promise<WordPressPublishResult> {
  const tagIds = await ensureTagIds(config, input.tags, fetchFn);

  // El JSON-LD se añade DESPUÉS del saneado del contenido, a propósito: es un bloque que
  // genera la propia app (no entrada del usuario) y el saneador lo eliminaría.
  const jsonLdBlock = input.jsonLd
    ? `\n<script type="application/ld+json">${JSON.stringify(input.jsonLd)}</script>`
    : "";

  const { status, json } = await wpRequest(
    config,
    "/posts",
    {
      title: input.title,
      slug: input.slug,
      content: `${input.contentHtml}${jsonLdBlock}`,
      excerpt: input.excerpt,
      status: input.status,
      tags: tagIds,
    },
    fetchFn,
  );

  if (status !== 201 || typeof json.id !== "number") {
    const message = typeof json.message === "string" ? json.message : `HTTP ${status}`;
    throw new Error(`WordPress rechazó el post: ${message}`);
  }

  return { postId: json.id, link: typeof json.link === "string" ? json.link : config.baseUrl };
}
