import type { WordPressConfig } from "@/lib/publish/wordpress";
import type { SearchConfig, SearchProviderId } from "@/lib/search";

import { getAppSetting } from "./app-config";
import { SECRET_KEYS, SETTING_KEYS } from "./keys";
import { getSecret } from "./secrets";

/**
 * Configuración resuelta de integraciones externas, con las claves YA descifradas. La
 * consumen el cliente de IA (clave de OpenRouter) y la etapa de research (proveedor de
 * búsqueda). Solo se usa en el servidor.
 */

/** Clave de API de OpenRouter en claro, o null si el admin aún no la configuró. */
export function getOpenRouterApiKey(): Promise<string | null> {
  return getSecret(SECRET_KEYS.openRouter);
}

/**
 * Configuración de WordPress resuelta (contraseña descifrada), o null si falta algún campo:
 * el botón de publicar solo se ofrece cuando la integración está completa.
 */
export async function getWordPressConfig(): Promise<WordPressConfig | null> {
  const [baseUrl, username, appPassword] = await Promise.all([
    getAppSetting(SETTING_KEYS.wordpressUrl),
    getAppSetting(SETTING_KEYS.wordpressUsername),
    getSecret(SECRET_KEYS.wordpressAppPassword),
  ]);
  if (!baseUrl?.trim() || !username?.trim() || !appPassword) return null;
  return { baseUrl: baseUrl.trim(), username: username.trim(), appPassword };
}

const VALID_PROVIDERS: readonly SearchProviderId[] = ["tavily", "google"];

/** Configuración de búsqueda resuelta (proveedor activo + credenciales descifradas). */
export async function getSearchConfig(): Promise<SearchConfig> {
  const [rawProvider, tavilyApiKey, googleApiKey, googleEngineId] = await Promise.all([
    getAppSetting(SETTING_KEYS.searchProvider),
    getSecret(SECRET_KEYS.tavily),
    getSecret(SECRET_KEYS.googleCse),
    getAppSetting(SETTING_KEYS.googleEngineId),
  ]);

  // Tavily es el proveedor por defecto si no hay nada configurado o el valor es inválido.
  const provider: SearchProviderId =
    rawProvider && VALID_PROVIDERS.includes(rawProvider as SearchProviderId)
      ? (rawProvider as SearchProviderId)
      : "tavily";

  return {
    provider,
    tavilyApiKey: tavilyApiKey ?? undefined,
    googleApiKey: googleApiKey ?? undefined,
    googleEngineId: googleEngineId ?? undefined,
  };
}
