import type { PipelineSource } from "@/lib/pipeline/types";

const MIN_USEFUL_CONTENT_CHARS = 280;
const AUTO_FRESHNESS_DAYS = 45;

const BLOCKED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "threads.net",
  "linkedin.com",
  "reddit.com",
];

const COMMUNITY_REFERENCE_DOMAINS = ["wikipedia.org", "fandom.com"];

function hostnameOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchesDomain(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function normalizedLength(text: string): number {
  return text.replace(/\s+/g, " ").trim().length;
}

function isOfficialSource(source: PipelineSource): boolean {
  const hostname = hostnameOf(source.url);
  const domainParts = hostname.split(".");
  const officialDomain =
    hostname.endsWith(".int") ||
    domainParts.some((part) => ["gov", "gob", "government", "admin"].includes(part));
  const officialTitle =
    /\b(oficial|official|comunicado|press release|sala de prensa|newsroom)\b/i.test(source.title);
  return officialDomain || officialTitle;
}

function isCommunityReference(source: PipelineSource): boolean {
  return matchesDomain(hostnameOf(source.url), COMMUNITY_REFERENCE_DOMAINS);
}

function sourceScore(source: PipelineSource, topic: string, currentYear: number): number {
  const contentLength = normalizedLength(source.content);
  const visibleMetadata = `${source.title} ${source.url} ${source.snippet}`;
  const topicYears = topic.match(/\b20\d{2}\b/g) ?? [];
  let score = 0;

  if (isOfficialSource(source)) score += 8;
  if (
    /\b(hoy|today|actualizado|updated|última hora|breaking|resultados?|results?)\b/i.test(
      visibleMetadata,
    )
  ) {
    score += 2;
  }
  if (visibleMetadata.includes(String(currentYear))) score += 2;
  if (topicYears.some((year) => visibleMetadata.includes(year))) score += 2;
  if (contentLength >= 3_000) score += 3;
  else if (contentLength >= 1_000) score += 2;
  else if (contentLength >= MIN_USEFUL_CONTENT_CHARS) score += 1;
  if (source.suspicious) score -= 8;
  if (isCommunityReference(source)) score -= 6;

  return score;
}

/**
 * Aplica frescura automática solo cuando el tema da una señal temporal inequívoca. Los tipos de
 * noticia siguen pudiendo fijar una ventana distinta, que siempre tiene prioridad.
 */
export function resolveResearchFreshnessDays(
  topic: string,
  configuredDays: number,
  now = new Date(),
): number {
  if (configuredDays > 0) return configuredDays;
  const currentYear = String(now.getUTCFullYear());
  const signalsCurrentEvent =
    topic.includes(currentYear) ||
    /\b(hoy|today|actualidad|última hora|breaking|resultado reciente)\b/i.test(topic);
  return signalsCurrentEvent ? AUTO_FRESHNESS_DAYS : 0;
}

/**
 * Descarta fuentes impropias para construir hechos y ordena el resto por autoridad, actualidad
 * visible y cantidad de contenido. Si todas son breves, conserva la mejor como degradación para
 * no romper temas muy minoritarios; si hay cuerpos útiles, los snippets mínimos quedan fuera.
 */
export function selectHighQualitySources(
  sources: PipelineSource[],
  limit: number,
  topic: string,
  now = new Date(),
): PipelineSource[] {
  const allowed = sources.filter(
    (source) => !matchesDomain(hostnameOf(source.url), BLOCKED_DOMAINS),
  );
  if (allowed.length === 0) return [];

  const useful = allowed.filter(
    (source) => normalizedLength(source.content) >= MIN_USEFUL_CONTENT_CHARS,
  );
  let candidates = useful.length > 0 ? useful : allowed;

  const clean = candidates.filter((source) => !source.suspicious);
  if (clean.length > 0) candidates = clean;

  const nonCommunity = candidates.filter((source) => !isCommunityReference(source));
  if (nonCommunity.length >= Math.min(limit, 2)) candidates = nonCommunity;

  const currentYear = now.getUTCFullYear();
  return candidates
    .map((source, discoveryOrder) => ({
      source,
      discoveryOrder,
      score: sourceScore(source, topic, currentYear),
    }))
    .sort((a, b) => b.score - a.score || a.discoveryOrder - b.discoveryOrder)
    .slice(0, limit)
    .map(({ source }) => source);
}
