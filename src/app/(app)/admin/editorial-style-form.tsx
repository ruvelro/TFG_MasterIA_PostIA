"use client";

import { useState } from "react";

import type { StyleAnalysisResult, StyleProfile } from "@/lib/pipeline/schemas";

import { saveStyleProfile } from "./actions";
import { useStyleAnalyzer } from "./use-style-analyzer";

const inputClass =
  "border-muted/30 focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

/**
 * Configuración de la identidad editorial. Dos modos sobre el mismo perfil editable:
 * "Editar a mano" y "Entrenar desde URLs" (analiza N artículos con IA y rellena los campos
 * para que el admin los revise antes de guardar). El entrenamiento nunca guarda por su cuenta.
 */
export function EditorialStyleForm({
  initialProfile,
  initialAnalyzerModel,
}: {
  initialProfile: StyleProfile;
  initialAnalyzerModel: string;
}) {
  const [mode, setMode] = useState<"manual" | "train">("manual");

  // Campos del perfil.
  const [brandVoice, setBrandVoice] = useState(initialProfile.brandVoice);
  const [houseRules, setHouseRules] = useState(initialProfile.houseRules);
  const [eeatAuthor, setEeatAuthor] = useState(initialProfile.eeatAuthor);
  const [seoRules, setSeoRules] = useState(initialProfile.seoRules);
  const [geoRules, setGeoRules] = useState(initialProfile.geoRules);
  const [languageRegion, setLanguageRegion] = useState(initialProfile.languageRegion);
  const [forbiddenText, setForbiddenText] = useState(initialProfile.forbiddenWords.join("\n"));
  const [examples, setExamples] = useState<string[]>(
    initialProfile.fewShotExamples.length > 0 ? initialProfile.fewShotExamples : [""],
  );

  // Entrenamiento.
  const [analyzerModel, setAnalyzerModel] = useState(initialAnalyzerModel);
  const [urls, setUrls] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function assembleProfile(): StyleProfile {
    return {
      brandVoice,
      houseRules,
      eeatAuthor,
      seoRules,
      geoRules,
      languageRegion,
      forbiddenWords: forbiddenText
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean),
      fewShotExamples: examples.map((e) => e.trim()).filter(Boolean),
    };
  }

  // Vuelca el resultado del analizador en los campos (SEO/GEO se dejan intactos: son manuales).
  function applyAnalysis(profile: StyleAnalysisResult) {
    setBrandVoice(profile.brandVoice);
    setHouseRules(profile.houseRules);
    setEeatAuthor(profile.eeatAuthor);
    setLanguageRegion(profile.languageRegion);
    setForbiddenText(profile.forbiddenWords.join("\n"));
    setExamples(profile.fewShotExamples.length > 0 ? profile.fewShotExamples : [""]);
  }

  // Vuelca el resultado del analizador en los campos y vuelve al modo manual para revisarlo.
  const { analyze, analyzing, progress, error } = useStyleAnalyzer((profile) => {
    applyAnalysis(profile);
    setMessage("Perfil generado. Revísalo y guárdalo.");
    setMode("manual");
  });

  const busy = saving || analyzing;

  function runAnalysis() {
    setMessage(null);
    void analyze(
      urls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveStyleProfile(assembleProfile(), analyzerModel);
      setMessage("Perfil de estilo guardado.");
    } catch {
      setMessage("No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? "bg-primary text-white" : "border-muted/30 border"
    }`;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Estilo editorial de la marca</h2>
        <p className="text-muted text-sm">
          Define cómo escribe tu publicación. Edítalo a mano o entrénalo automáticamente a partir de
          artículos existentes.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={tabClass(mode === "manual")}
        >
          ✎ Editar a mano
        </button>
        <button
          type="button"
          onClick={() => setMode("train")}
          className={tabClass(mode === "train")}
        >
          🌐 Entrenar desde URLs
        </button>
      </div>

      {message ? <p className="text-muted text-sm">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}

      {mode === "manual" ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Voz de marca (tono y personalidad)</span>
            <textarea
              rows={3}
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Reglas de casa (qué sí / qué no)</span>
            <textarea
              rows={3}
              value={houseRules}
              onChange={(e) => setHouseRules(e.target.value)}
              className={inputClass}
            />
          </label>

          <fieldset className="border-muted/20 flex flex-col gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Autoridad y optimización</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Credenciales E-E-A-T (autor / medio)</span>
              <textarea
                rows={2}
                value={eeatAuthor}
                onChange={(e) => setEeatAuthor(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Reglas SEO (optimización para buscadores)</span>
              <textarea
                rows={2}
                value={seoRules}
                onChange={(e) => setSeoRules(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Reglas GEO (optimización para motores generativos)
              </span>
              <textarea
                rows={2}
                value={geoRules}
                onChange={(e) => setGeoRules(e.target.value)}
                className={inputClass}
              />
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Idioma y región</span>
            <input
              value={languageRegion}
              onChange={(e) => setLanguageRegion(e.target.value)}
              placeholder="p. ej. Español de España, registro divulgativo"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Palabras prohibidas (una por línea)</span>
            <textarea
              rows={4}
              value={forbiddenText}
              onChange={(e) => setForbiddenText(e.target.value)}
              placeholder="Muletillas de IA a evitar, p. ej. «en conclusión»"
              className={`${inputClass} font-mono`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Ejemplos de estilo (párrafos de referencia)</span>
            {examples.map((example, index) => (
              <div key={index} className="flex flex-col gap-1">
                <textarea
                  rows={3}
                  value={example}
                  onChange={(e) =>
                    setExamples((prev) => prev.map((x, i) => (i === index ? e.target.value : x)))
                  }
                  placeholder="Pega un párrafo real escrito en el estilo deseado"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setExamples((prev) => prev.filter((_, i) => i !== index))}
                  className="self-end text-xs font-medium text-red-600"
                >
                  Eliminar ejemplo
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExamples((prev) => [...prev, ""])}
              className="border-muted/30 self-start rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Añadir ejemplo
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted text-sm">
            Pega las URLs de artículos que representen tu estilo (una por línea; puedes pegar desde
            una hasta varios cientos). La IA las analizará y rellenará los campos del modo manual
            para que los revises antes de guardar. Las reglas SEO/GEO se mantienen manuales (son
            decisión editorial, no se infieren del texto).
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Modelo del analizador</span>
            <input
              value={analyzerModel}
              onChange={(e) => setAnalyzerModel(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">URLs a analizar (una por línea)</span>
            <textarea
              rows={8}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"https://tu-medio.com/articulo-1\nhttps://tu-medio.com/articulo-2"}
              className={`${inputClass} font-mono`}
            />
          </label>

          {progress ? <p className="text-primary text-sm">{progress}</p> : null}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={busy}
            className="bg-primary self-start rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {analyzing ? "Analizando…" : "Analizar y generar perfil"}
          </button>
        </div>
      )}
    </section>
  );
}
