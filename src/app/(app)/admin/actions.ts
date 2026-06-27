"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/authorize";
import { AI_STAGE_IDS, type AiStageId } from "@/lib/pipeline/default-config";
import {
  LengthPresetCatalogSchema,
  NewsTypeCatalogSchema,
  StyleProfileSchema,
  ValidatorConfigSchema,
} from "@/lib/pipeline/schemas";
import { setAppSetting } from "@/lib/settings/app-config";
import { serializeStyleProfile, serializeValidatorConfig } from "@/lib/settings/generation-config";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/settings/keys";
import { serializeLengthPresets } from "@/lib/settings/length-presets";
import { serializeNewsTypes } from "@/lib/settings/news-types";
import { setStepConfig } from "@/lib/settings/pipeline-config";
import { setSecret } from "@/lib/settings/secrets";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Guarda las claves de integraciones y el proveedor de búsqueda. Cada acción REVALIDA su
 * propia autorización (`requireAdmin`): no basta con que la página esté protegida, porque
 * una Server Action es invocable por POST directo.
 *
 * Los campos de secreto vacíos se ignoran a propósito: así guardar el formulario sin volver
 * a escribir la clave no la borra (no podemos mostrar la clave actual en el input).
 */
export async function saveIntegrations(formData: FormData): Promise<void> {
  await requireAdmin();

  const openrouter = field(formData, "openrouter");
  const tavily = field(formData, "tavily");
  const google = field(formData, "google");
  const engineId = field(formData, "googleEngineId");
  const provider = field(formData, "searchProvider");

  if (openrouter) await setSecret(SECRET_KEYS.openRouter, openrouter);
  if (tavily) await setSecret(SECRET_KEYS.tavily, tavily);
  if (google) await setSecret(SECRET_KEYS.googleCse, google);
  if (engineId) await setAppSetting(SETTING_KEYS.googleEngineId, engineId);
  if (provider === "tavily" || provider === "google") {
    await setAppSetting(SETTING_KEYS.searchProvider, provider);
  }

  revalidatePath("/admin");
}

/**
 * Guarda la configuración de generación: límites de recursos (nº de fuentes, iteraciones del
 * fixer), parámetros del bucle de calidad (re-humanizaciones y umbral de aiScore) y patrones
 * de limpieza final. La identidad editorial se gestiona aparte (`saveStyleProfile`). Los
 * rangos se sanean al leer en `getGenerationConfig`.
 */
export async function saveGenerationConfig(formData: FormData): Promise<void> {
  await requireAdmin();

  await setAppSetting(SETTING_KEYS.sourceCount, field(formData, "sourceCount"));
  await setAppSetting(SETTING_KEYS.maxFixIterations, field(formData, "maxFixIterations"));
  await setAppSetting(SETTING_KEYS.maxHumanizeRetries, field(formData, "maxHumanizeRetries"));
  await setAppSetting(SETTING_KEYS.aiScoreThreshold, field(formData, "aiScoreThreshold"));
  await setAppSetting(SETTING_KEYS.scrubPatterns, field(formData, "scrubPatterns"));

  revalidatePath("/admin");
}

/**
 * Guarda el perfil de estilo editorial (voz, reglas, autoridad, SEO/GEO, palabras prohibidas
 * y ejemplos) y el modelo del analizador. El perfil llega ya ensamblado desde el formulario
 * cliente y se valida con Zod antes de persistirlo como JSON.
 */
export async function saveStyleProfile(
  profileInput: unknown,
  analyzerModel: string,
): Promise<void> {
  await requireAdmin();

  const parsed = StyleProfileSchema.safeParse(profileInput);
  if (!parsed.success) {
    throw new Error("Perfil de estilo inválido");
  }

  await setAppSetting(SETTING_KEYS.styleProfile, serializeStyleProfile(parsed.data));
  await setAppSetting(SETTING_KEYS.styleAnalyzerModel, analyzerModel.trim());

  revalidatePath("/admin");
}

/** Lee una severidad del formulario, cayendo a "warning" si el valor no es válido. */
function severityField(formData: FormData, name: string): "error" | "warning" {
  return field(formData, name) === "error" ? "error" : "warning";
}

/**
 * Guarda la configuración del validador editorial determinista: por cada regla, si está activa
 * y con qué severidad; además, los patrones de IA y el mínimo de palabras para el solapamiento
 * con fuentes. Se valida con Zod antes de persistir.
 */
export async function saveValidatorConfig(formData: FormData): Promise<void> {
  await requireAdmin();

  const minPhraseWords = Number.parseInt(field(formData, "sourceOverlap.minPhraseWords"), 10);
  const config = {
    forbiddenWords: {
      enabled: formData.get("forbiddenWords.enabled") === "on",
      severity: severityField(formData, "forbiddenWords.severity"),
    },
    aiPatterns: {
      enabled: formData.get("aiPatterns.enabled") === "on",
      severity: severityField(formData, "aiPatterns.severity"),
      patterns: field(formData, "aiPatterns.patterns")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
    sourceOverlap: {
      enabled: formData.get("sourceOverlap.enabled") === "on",
      severity: severityField(formData, "sourceOverlap.severity"),
      minPhraseWords: Number.isNaN(minPhraseWords) ? 8 : Math.min(Math.max(minPhraseWords, 3), 30),
    },
  };

  const parsed = ValidatorConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error("Configuración del validador inválida");
  }

  await setAppSetting(SETTING_KEYS.validatorConfig, serializeValidatorConfig(parsed.data));
  revalidatePath("/admin");
}

/**
 * Guarda el catálogo de tipos de noticia (presets del pipeline). El catálogo llega ya
 * ensamblado desde el formulario cliente; se valida con Zod (incluida la unicidad de ids)
 * antes de persistirlo como JSON. Rechaza catálogos vacíos: siempre debe existir un tipo.
 */
export async function saveNewsTypes(typesInput: unknown): Promise<void> {
  await requireAdmin();

  const parsed = NewsTypeCatalogSchema.safeParse(typesInput);
  if (!parsed.success) {
    throw new Error("Catálogo de tipos de noticia inválido");
  }
  if (parsed.data.length === 0) {
    throw new Error("Debe existir al menos un tipo de noticia");
  }
  const ids = parsed.data.map((t) => t.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Los identificadores de tipo deben ser únicos");
  }

  await setAppSetting(SETTING_KEYS.newsTypes, serializeNewsTypes(parsed.data));
  revalidatePath("/admin");
  revalidatePath("/generate");
}

/**
 * Guarda el catálogo de presets de longitud. Llega ensamblado desde el formulario cliente y se
 * valida con Zod (incluida la unicidad de ids y el rango min≤max) antes de persistirlo como JSON.
 */
export async function saveLengthPresets(presetsInput: unknown): Promise<void> {
  await requireAdmin();

  const parsed = LengthPresetCatalogSchema.safeParse(presetsInput);
  if (!parsed.success) {
    throw new Error("Catálogo de presets de longitud inválido");
  }
  if (parsed.data.length === 0) {
    throw new Error("Debe existir al menos un preset de longitud");
  }
  const ids = parsed.data.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Los identificadores de preset deben ser únicos");
  }

  await setAppSetting(SETTING_KEYS.lengthPresets, serializeLengthPresets(parsed.data));
  revalidatePath("/admin");
  revalidatePath("/generate");
}

/** Guarda el modelo y el prompt de una etapa del pipeline. */
export async function saveStepConfig(formData: FormData): Promise<void> {
  await requireAdmin();

  const stageId = field(formData, "stageId");
  const model = field(formData, "model");
  const prompt = field(formData, "prompt");

  if (!(AI_STAGE_IDS as readonly string[]).includes(stageId)) {
    throw new Error("Etapa de pipeline desconocida");
  }
  if (!model || !prompt) {
    throw new Error("El modelo y el prompt son obligatorios");
  }

  await setStepConfig(stageId as AiStageId, { model, prompt });
  revalidatePath("/admin");
}
