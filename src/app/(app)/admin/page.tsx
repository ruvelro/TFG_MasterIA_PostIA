import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { AI_STAGE_IDS } from "@/lib/pipeline/default-config";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";
import { getAppSetting } from "@/lib/settings/app-config";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/settings/keys";
import { getAllStepConfigs } from "@/lib/settings/pipeline-config";
import { getSecretStatus } from "@/lib/settings/secrets";

import { saveIntegrations, saveStepConfig } from "./actions";

const STAGE_LABEL = new Map(PIPELINE_STAGES.map((stage) => [stage.id, stage.label]));

// Placeholder de un input de secreto: muestra el estado actual sin revelar la clave.
function secretPlaceholder(status: { configured: boolean; masked: string | null }): string {
  return status.configured
    ? `Configurada (${status.masked}) — escribe para cambiarla`
    : "Sin configurar";
}

// Panel de administración. Solo accesible por administradores: la comprobación de rol se
// hace aquí (el proxy solo verifica que haya sesión, no el rol).
export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/generate");

  const [openRouter, tavily, google, searchProvider, googleEngineId, stepConfigs] =
    await Promise.all([
      getSecretStatus(SECRET_KEYS.openRouter),
      getSecretStatus(SECRET_KEYS.tavily),
      getSecretStatus(SECRET_KEYS.googleCse),
      getAppSetting(SETTING_KEYS.searchProvider),
      getAppSetting(SETTING_KEYS.googleEngineId),
      getAllStepConfigs(),
    ]);

  const inputClass =
    "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-muted mt-1 text-sm">
          Claves de API (cifradas en la base de datos) y configuración del pipeline.
        </p>
      </div>

      {/* ── Integraciones / claves de API ───────────────────────────────── */}
      <form action={saveIntegrations} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Claves de API</h2>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">OpenRouter API Key</span>
          <input
            name="openrouter"
            type="password"
            className={inputClass}
            placeholder={secretPlaceholder(openRouter)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Proveedor de búsqueda</span>
          <select
            name="searchProvider"
            defaultValue={searchProvider ?? "tavily"}
            className={inputClass}
          >
            <option value="tavily">Tavily</option>
            <option value="google">Google Custom Search</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tavily API Key</span>
          <input
            name="tavily"
            type="password"
            className={inputClass}
            placeholder={secretPlaceholder(tavily)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Google CSE API Key</span>
          <input
            name="google"
            type="password"
            className={inputClass}
            placeholder={secretPlaceholder(google)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Google CSE Engine ID</span>
          <input
            name="googleEngineId"
            type="text"
            defaultValue={googleEngineId ?? ""}
            className={inputClass}
            placeholder="Sin configurar"
          />
        </label>

        <button
          type="submit"
          className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white"
        >
          Guardar claves
        </button>
      </form>

      {/* ── Configuración por etapa del pipeline ────────────────────────── */}
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Pipeline: modelo y prompt por etapa</h2>
        {AI_STAGE_IDS.map((stageId) => {
          const config = stepConfigs[stageId];
          return (
            <form
              key={stageId}
              action={saveStepConfig}
              className="border-muted/20 flex flex-col gap-3 rounded-lg border p-4"
            >
              <input type="hidden" name="stageId" value={stageId} />
              <h3 className="font-medium">{STAGE_LABEL.get(stageId) ?? stageId}</h3>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Modelo (OpenRouter)</span>
                <input
                  name="model"
                  type="text"
                  defaultValue={config.model}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Prompt (plantilla)</span>
                <textarea
                  name="prompt"
                  rows={8}
                  defaultValue={config.prompt}
                  className={`${inputClass} font-mono`}
                />
              </label>

              <button
                type="submit"
                className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white"
              >
                Guardar etapa
              </button>
            </form>
          );
        })}
        <p className="text-muted text-xs">
          Variables disponibles en los prompts: <code>{"{{topic}}"}</code>,{" "}
          <code>{"{{sources}}"}</code>, <code>{"{{outline}}"}</code>, <code>{"{{draft}}"}</code>.
        </p>
      </div>
    </section>
  );
}
