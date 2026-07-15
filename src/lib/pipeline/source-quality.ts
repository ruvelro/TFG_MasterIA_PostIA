import { createHash } from "node:crypto";

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

const GENERIC_TOKENS = new Set([
  "actualizado",
  "analysis",
  "analisis",
  "article",
  "claves",
  "comunicado",
  "noticia",
  "news",
  "oficial",
  "official",
  "prediction",
  "press",
  "prevision",
]);

const STOP_WORDS = new Set([
  "para",
  "como",
  "desde",
  "hasta",
  "sobre",
  "entre",
  "esta",
  "este",
  "that",
  "this",
  "with",
  "from",
  "into",
  "have",
]);

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

function normalizedSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Identificadores cuya mezcla de letras y cifras no admite sustituir una versión vecina. */
export function extractDistinctiveIdentifiers(text: string): Set<string> {
  const chunks = normalizedSearchText(text).match(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g) ?? [];
  return new Set(
    chunks
      .map((chunk) => chunk.replace(/[._-]/g, ""))
      .filter((chunk) => chunk.length >= 3 && /[a-z]/.test(chunk) && /\d/.test(chunk)),
  );
}

function compactSearchText(text: string): string {
  return normalizedSearchText(text).replace(/[^a-z0-9]/g, "");
}

function tokensOf(text: string, ignoredTokens: Set<string> = new Set()): Set<string> {
  const normalized = normalizedSearchText(text);
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return new Set(
    tokens
      .map((token) => {
        if (token.length > 6 && token.endsWith("es")) return token.slice(0, -2);
        if (token.length > 5 && token.endsWith("s")) return token.slice(0, -1);
        return token;
      })
      .filter(
        (token) =>
          token.length >= 4 &&
          !/^\d+$/.test(token) &&
          !GENERIC_TOKENS.has(token) &&
          !STOP_WORDS.has(token) &&
          !ignoredTokens.has(token),
      ),
  );
}

function overlapSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function sourceIsRelevant(source: PipelineSource, topic: string): boolean {
  const hostname = hostnameOf(source.url);
  const ignoredDomainTokens = tokensOf(hostname);
  const pathname = (() => {
    try {
      return new URL(source.url).pathname;
    } catch {
      return "";
    }
  })();
  const topicTokens = tokensOf(topic);
  const titleTokens = tokensOf(`${source.title} ${pathname}`, ignoredDomainTokens);
  const snippetTokens = tokensOf(source.snippet, ignoredDomainTokens);
  const titleTopicOverlap = overlapSize(titleTokens, topicTokens);
  const snippetTopicOverlap = overlapSize(snippetTokens, topicTokens);
  const titleSnippetOverlap = overlapSize(titleTokens, snippetTokens);
  const topicYears = new Set(topic.match(/\b20\d{2}\b/g) ?? []);
  const metadataYears = new Set(
    `${source.title} ${source.url} ${source.snippet}`.match(/\b20\d{2}\b/g) ?? [],
  );
  const sharesTopicYear = [...topicYears].some((year) => metadataYears.has(year));
  const topicIdentifiers = extractDistinctiveIdentifiers(topic);
  if (topicIdentifiers.size > 0) {
    const metadata = compactSearchText(`${source.title} ${source.url} ${source.snippet}`);
    const content = compactSearchText(source.content);
    const preservesIdentifier = [...topicIdentifiers].some(
      (identifier) => metadata.includes(identifier) && content.includes(identifier),
    );
    if (!preservesIdentifier) return false;
  }

  if (titleTopicOverlap > 0) return true;
  if (titleSnippetOverlap > 0 && snippetTopicOverlap > 0) return true;
  return isOfficialSource(source) && (snippetTopicOverlap > 0 || sharesTopicYear);
}

function contentSignature(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

function deduplicateByContent(sources: PipelineSource[]): PipelineSource[] {
  const signatures = new Set<string>();
  return sources.filter((source) => {
    const signature = contentSignature(source.content);
    if (signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  });
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
  const topicalCoverage = overlapSize(tokensOf(source.content), tokensOf(topic));
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
  score += Math.min(topicalCoverage, 4);
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
  const currentHalfYearVersion = new RegExp(`\\b${currentYear.slice(-2)}h[12]\\b`, "i");
  const signalsCurrentEvent =
    topic.includes(currentYear) ||
    currentHalfYearVersion.test(topic) ||
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
  const topicAllowsBetting = /\b(apuestas?|betting|odds|cuotas?|casino)\b/i.test(topic);
  const allowed = sources.filter((source) => {
    if (matchesDomain(hostnameOf(source.url), BLOCKED_DOMAINS)) return false;
    if (
      !topicAllowsBetting &&
      /sports[-_/]?betting|betting[-_/]?tips|\/odds?(?:\/|$)/i.test(source.url)
    ) {
      return false;
    }
    return sourceIsRelevant(source, topic);
  });
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
  const ranked = candidates
    .map((source, discoveryOrder) => ({
      source,
      discoveryOrder,
      score: sourceScore(source, topic, currentYear),
    }))
    .sort((a, b) => b.score - a.score || a.discoveryOrder - b.discoveryOrder)
    .map(({ source }) => source);
  return deduplicateByContent(ranked).slice(0, limit);
}
