"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/authorize";
import { AI_STAGE_IDS, type AiStageId } from "@/lib/pipeline/default-config";
import { setAppSetting } from "@/lib/settings/app-config";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/settings/keys";
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
