import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { AI_STAGE_IDS } from "@/lib/pipeline/default-config";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";
import { getAppSetting } from "@/lib/settings/app-config";
import {
  getGenerationConfig,
  getStyleAnalyzerModel,
  getValidatorConfig,
  serializeScrubPatterns,
} from "@/lib/settings/generation-config";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/settings/keys";
import { getLengthPresets } from "@/lib/settings/length-presets";
import { getNewsTypes } from "@/lib/settings/news-types";
import { getAllStepConfigs } from "@/lib/settings/pipeline-config";
import { getSecretStatus } from "@/lib/settings/secrets";

import {
  saveGenerationConfig,
  saveIntegrations,
  saveStepConfig,
  saveValidatorConfig,
} from "./actions";
import { AdminForm } from "./admin-form";
import { AdminTabs, type AdminTab } from "./admin-tabs";
import { CostPanel } from "./cost-panel";
import { EditorialStyleForm } from "./editorial-style-form";
import { ErrorLogPanel } from "./error-log-panel";
import { LengthPresetsForm } from "./length-presets-form";
import { NewsTypesForm } from "./news-types-form";

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

  const [
    openRouter,
    tavily,
    google,
    searchProvider,
    googleEngineId,
    stepConfigs,
    generation,
    analyzerModel,
    validator,
    newsTypes,
    lengthPresets,
  ] = await Promise.all([
    getSecretStatus(SECRET_KEYS.openRouter),
    getSecretStatus(SECRET_KEYS.tavily),
    getSecretStatus(SECRET_KEYS.googleCse),
    getAppSetting(SETTING_KEYS.searchProvider),
    getAppSetting(SETTING_KEYS.googleEngineId),
    getAllStepConfigs(),
    getGenerationConfig(),
    getStyleAnalyzerModel(),
    getValidatorConfig(),
    getNewsTypes(),
    getLengthPresets(),
  ]);

  const inputClass =
    "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

  const tabs: AdminTab[] = [
    {
      id: "integrations",
      label: "Claves API",
      content: (
        <AdminForm action={saveIntegrations} label="Guardar claves">
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
        </AdminForm>
      ),
    },
    {
      id: "style",
      label: "Estilo global",
      content: (
        <EditorialStyleForm
          initialProfile={generation.styleProfile}
          initialAnalyzerModel={analyzerModel}
        />
      ),
    },
    {
      id: "news-types",
      label: "Tipos de noticia",
      content: <NewsTypesForm initialTypes={newsTypes} />,
    },
    {
      id: "lengths",
      label: "Longitudes",
      content: <LengthPresetsForm initialPresets={lengthPresets} />,
    },
    {
      id: "generation",
      label: "Generación",
      content: (
        <AdminForm action={saveGenerationConfig} label="Guardar configuración">
          <h2 className="text-lg font-semibold">Configuración de generación</h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nº de fuentes (research)</span>
              <input
                name="sourceCount"
                type="number"
                min={1}
                max={10}
                defaultValue={generation.sourceCount}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Presupuesto diario por usuario (USD, 0 = sin límite)
              </span>
              <input
                name="dailyCostLimitUsd"
                type="number"
                min={0}
                max={10000}
                step={0.01}
                defaultValue={generation.dailyCostLimitUsd}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Modelo de expansión de consultas (research)</span>
              <input
                name="queryExpansionModel"
                type="text"
                defaultValue={generation.queryExpansionModel}
                placeholder="google/gemini-2.5-flash · vacío = desactivada"
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Iteraciones máx. del fixer</span>
              <input
                name="maxFixIterations"
                type="number"
                min={0}
                max={5}
                defaultValue={generation.maxFixIterations}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Re-humanizaciones máx.</span>
              <input
                name="maxHumanizeRetries"
                type="number"
                min={0}
                max={5}
                defaultValue={generation.maxHumanizeRetries}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Umbral de aiScore (re-humanizar)</span>
              <input
                name="aiScoreThreshold"
                type="number"
                min={0}
                max={100}
                defaultValue={generation.aiScoreThreshold}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Reintentos por llamada de IA</span>
              <input
                name="aiMaxRetries"
                type="number"
                min={0}
                max={5}
                defaultValue={generation.aiMaxRetries}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Timeout por llamada de IA (ms)</span>
              <input
                name="aiTimeoutMs"
                type="number"
                min={10000}
                max={300000}
                step={1000}
                defaultValue={generation.aiTimeoutMs}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Patrones de limpieza (uno por línea)</span>
            <textarea
              name="scrubPatterns"
              rows={6}
              defaultValue={serializeScrubPatterns(generation.scrubPatterns)}
              className={`${inputClass} font-mono`}
              placeholder="Expresiones regulares a eliminar del texto final…"
            />
            <span className="text-muted text-xs">
              Cada línea es una expresión regular (flags <code>gi</code>) que se elimina del
              artículo final. Déjalo vacío para desactivar la limpieza.
            </span>
          </label>
        </AdminForm>
      ),
    },
    {
      id: "validator",
      label: "Validador",
      content: (
        <AdminForm action={saveValidatorConfig} label="Guardar validador">
          <div>
            <h2 className="text-lg font-semibold">Validador editorial (determinista)</h2>
            <p className="text-muted text-sm">
              Reglas sin IA que complementan la validación: detectan problemas de forma
              reproducible. Las de severidad <strong>error</strong> obligan a una corrección; las de{" "}
              <strong>aviso</strong> solo informan.
            </p>
          </div>

          {/* Regla: palabras prohibidas */}
          <fieldset className="border-muted/20 flex flex-col gap-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Palabras prohibidas</legend>
            <p className="text-muted text-xs">
              Detecta en el artículo las palabras vetadas del perfil de estilo.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="forbiddenWords.enabled"
                  defaultChecked={validator.forbiddenWords.enabled}
                />
                <span>Activa</span>
              </label>
              <select
                name="forbiddenWords.severity"
                defaultValue={validator.forbiddenWords.severity}
                className={inputClass}
              >
                <option value="error">Error (bloquea)</option>
                <option value="warning">Aviso</option>
              </select>
            </div>
          </fieldset>

          {/* Regla: patrones de IA */}
          <fieldset className="border-muted/20 flex flex-col gap-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Patrones de redacción IA</legend>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="aiPatterns.enabled"
                  defaultChecked={validator.aiPatterns.enabled}
                />
                <span>Activa</span>
              </label>
              <select
                name="aiPatterns.severity"
                defaultValue={validator.aiPatterns.severity}
                className={inputClass}
              >
                <option value="error">Error (bloquea)</option>
                <option value="warning">Aviso</option>
              </select>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Patrones (una expresión regular por línea)</span>
              <textarea
                name="aiPatterns.patterns"
                rows={5}
                defaultValue={validator.aiPatterns.patterns.join("\n")}
                className={`${inputClass} font-mono`}
              />
            </label>
          </fieldset>

          {/* Regla: copia literal de fuentes */}
          <fieldset className="border-muted/20 flex flex-col gap-2 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Copia literal de fuentes</legend>
            <p className="text-muted text-xs">
              Detecta fragmentos copiados textualmente de las fuentes (a partir de N palabras).
            </p>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="sourceOverlap.enabled"
                  defaultChecked={validator.sourceOverlap.enabled}
                />
                <span>Activa</span>
              </label>
              <select
                name="sourceOverlap.severity"
                defaultValue={validator.sourceOverlap.severity}
                className={inputClass}
              >
                <option value="error">Error (bloquea)</option>
                <option value="warning">Aviso</option>
              </select>
              <label className="flex items-center gap-2">
                <span>Mín. palabras</span>
                <input
                  name="sourceOverlap.minPhraseWords"
                  type="number"
                  min={3}
                  max={30}
                  defaultValue={validator.sourceOverlap.minPhraseWords}
                  className={inputClass}
                />
              </label>
            </div>
          </fieldset>
        </AdminForm>
      ),
    },
    {
      id: "pipeline",
      label: "Pipeline",
      content: (
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">Pipeline: modelo y prompt por etapa</h2>
          {AI_STAGE_IDS.map((stageId) => {
            const config = stepConfigs[stageId];
            return (
              <AdminForm
                key={stageId}
                action={saveStepConfig}
                label="Guardar etapa"
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
              </AdminForm>
            );
          })}
          <p className="text-muted text-xs">
            Variables disponibles en los prompts: <code>{"{{topic}}"}</code>,{" "}
            <code>{"{{context}}"}</code>, <code>{"{{sources}}"}</code>, <code>{"{{facts}}"}</code>,{" "}
            <code>{"{{blueprint}}"}</code>, <code>{"{{draft}}"}</code>, <code>{"{{report}}"}</code>,{" "}
            <code>{"{{editorialVoice}}"}</code>, <code>{"{{seoRules}}"}</code>,{" "}
            <code>{"{{geoRules}}"}</code>, <code>{"{{formatDirectives}}"}</code>,{" "}
            <code>{"{{revisionInstructions}}"}</code>, <code>{"{{targetKeyword}}"}</code>,{" "}
            <code>{"{{article}}"}</code>. No todas aplican a cada etapa: el corrector usa{" "}
            <code>{"{{report}}"}</code> y el enriquecimiento <code>{"{{article}}"}</code> y{" "}
            <code>{"{{targetKeyword}}"}</code>.
          </p>
        </div>
      ),
    },
    {
      id: "cost",
      label: "Coste",
      content: <CostPanel />,
    },
    {
      id: "errors",
      label: "Errores",
      content: <ErrorLogPanel />,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-muted mt-1 text-sm">
          Claves de API (cifradas en la base de datos) y configuración del pipeline.
        </p>
      </div>

      <AdminTabs tabs={tabs} />
    </section>
  );
}
