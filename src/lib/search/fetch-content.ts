import { lookup as dnsLookup } from "node:dns/promises";

import { Readability } from "@mozilla/readability";
import ipaddr from "ipaddr.js";
import { parseHTML } from "linkedom";

// Descarga el contenido de una URL y lo reduce a texto legible, para que la etapa research
// pueda usar el cuerpo de las webs como fuente de verdad.
//
// Seguridad: descargar URLs arbitrarias en el servidor es un riesgo de SSRF. Defensas:
// - Solo http/https; hostnames internos e IPs no globales bloqueados (`assertSafeUrl`).
//   El parser WHATWG de `URL` normaliza las IPs en notación decimal u octal
//   (`http://2130706433/` → `127.0.0.1`), así que el guard las ve ya normalizadas.
// - El hostname se resuelve por DNS y CADA IP resultante se valida contra los rangos no
//   globales (privados, loopback, link-local, ULA, CGNAT…) vía `ipaddr.js`. Cubre el caso
//   de un dominio público con un registro A/AAAA apuntando a una IP interna.
// - Las redirecciones se siguen a mano para revalidar CADA salto (un 3xx hacia un host
//   interno burlaría una comprobación hecha solo sobre la URL inicial).
// - El cuerpo se lee por streaming con tope de bytes (aborta la descarga al superarlo) y
//   solo se aceptan Content-Type de texto.
// Riesgo residual asumido: la ventana resolución→conexión (DNS rebinding con TTL≈0). Cerrarla
// exigiría fijar la IP validada en la conexión, lo que con TLS obliga a gestionar SNI y la
// verificación de certificado a mano; se documenta como limitación en docs/seguridad.md.

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000; // 2 MB: suficiente para el texto de un artículo, acota memoria.
const MAX_REDIRECTS = 5; // Cota de saltos: evita bucles de redirección y limita el coste.

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

// Tipos de contenido aceptados: la etapa research solo sabe extraer texto de páginas.
// Rechazar el resto (binarios, JSON de APIs internas…) reduce superficie y memoria.
const ALLOWED_CONTENT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);

/**
 * Resolución DNS inyectable: los tests sustituyen la resolución real por una determinista
 * (dominio → IP privada) sin tocar la red. Debe devolver TODAS las direcciones del host.
 */
export type LookupFn = (hostname: string) => Promise<{ address: string }[]>;

const defaultLookup: LookupFn = async (hostname) => dnsLookup(hostname, { all: true });

/**
 * True si la IP NO es de unicast global: privadas (RFC 1918), loopback, link-local,
 * ULA/link-local IPv6, CGNAT (100.64/10), multicast, reservadas… `ipaddr.js` clasifica
 * también las IPv6 con IPv4 embebido (::ffff:192.168.0.1), que se comprueban desempaquetadas.
 */
export function isPrivateIp(ip: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true; // Si no se puede interpretar, se bloquea (fail-closed).
  }
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  return parsed.range() !== "unicast";
}

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

  // Las IPv6 literales llegan entre corchetes ("[::1]"); se quitan para poder analizarlas.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isIpLiteral = ipaddr.isValid(host);
  const isPrivate =
    BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || (isIpLiteral && isPrivateIp(host));

  if (isPrivate) {
    throw new Error("No se permite descargar recursos de hosts internos");
  }

  return url;
}

/**
 * Resuelve el hostname y lanza si ALGUNA de sus IPs no es global: un dominio público con
 * un registro DNS hacia una IP privada no debe alcanzar la red interna. Si el hostname ya
 * es una IP literal, `assertSafeUrl` la validó y no hay nada que resolver.
 */
async function assertSafeResolution(url: URL, lookup: LookupFn): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) return;

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new Error(`No se pudo resolver el host "${host}"`);
  }
  if (addresses.length === 0) {
    throw new Error(`No se pudo resolver el host "${host}"`);
  }
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("No se permite descargar recursos de hosts internos");
  }
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

// Por debajo de este tamaño no nos fiamos del extracto de Readability: en páginas atípicas
// (portadas, listados) puede aislar un bloque residual y perder el contenido real.
const MIN_READABLE_LENGTH = 200;

/**
 * Extrae el CUERPO del artículo de una página con Readability (el algoritmo del modo lectura
 * de Firefox) sobre linkedom (DOM sin navegador): descarta menús, banners de cookies y footers
 * que el stripping por regex conservaba como si fueran contenido. Si Readability no encuentra
 * un artículo con entidad, caemos al stripping clásico (mejor ruido que perder la fuente).
 */
export function extractArticleText(html: string): string {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document, {
      charThreshold: MIN_READABLE_LENGTH,
    }).parse();
    const text = article?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (text.length >= MIN_READABLE_LENGTH) return text;
  } catch {
    // linkedom/Readability pueden fallar con HTML muy malformado: degradamos al stripping.
  }
  return htmlToText(html);
}

/**
 * Lee el cuerpo por streaming con contador de bytes y ABORTA la descarga al superar el tope:
 * a diferencia de `text().slice()`, no descarga el resto de un cuerpo gigante para tirarlo.
 */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received >= maxBytes) {
      const keep = value.byteLength - (received - maxBytes);
      text += decoder.decode(value.subarray(0, keep), { stream: true });
      // Cancela el stream: cierra la conexión en vez de seguir recibiendo bytes.
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export interface FetchReadableTextOptions {
  /** Resolución DNS inyectable (tests). Por defecto, `dns.promises.lookup` con todas las IPs. */
  lookup?: LookupFn;
}

export async function fetchReadableText(
  rawUrl: string,
  options: FetchReadableTextOptions = {},
): Promise<string> {
  const lookup = options.lookup ?? defaultLookup;
  // El guard se aplica a la URL inicial y se repite en cada redirección dentro del bucle.
  let url = assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Validación del destino REAL: todas las IPs a las que resuelve el hostname.
      await assertSafeResolution(url, lookup);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        // "manual": no seguimos la redirección automáticamente para poder validar el destino
        // con el guard antes de ir a por él (clave anti-SSRF).
        redirect: "manual",
        headers: { "User-Agent": "PostIA/1.0 (+research)" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirección sin destino");
        // Resolvemos relativo a la URL actual y revalidamos con el guard antes de seguir.
        url = assertSafeUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`La descarga falló (${response.status})`);
      }

      const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.has(mime)) {
        throw new Error(`Tipo de contenido no soportado (${mime || "desconocido"})`);
      }

      const body = await readBodyCapped(response, MAX_BYTES);
      // Para HTML, Readability aísla el cuerpo del artículo; el texto plano solo se normaliza.
      return mime === "text/plain" ? body.replace(/\s+/g, " ").trim() : extractArticleText(body);
    }
    throw new Error("Demasiadas redirecciones");
  } finally {
    clearTimeout(timeout);
  }
}
