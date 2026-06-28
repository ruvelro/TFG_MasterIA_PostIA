import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { DEFAULT_PIPELINE_PARAMS } from "@/lib/pipeline/default-config";
import { DEFAULT_SCRUB_PATTERNS } from "@/lib/pipeline/steps/scrub";
import { DEFAULT_VALIDATOR_CONFIG } from "@/lib/pipeline/steps/editorial-validator";
import { setAppSetting } from "@/lib/settings/app-config";
import {
  EMPTY_STYLE_PROFILE,
  getGenerationConfig,
  getStyleProfile,
  getValidatorConfig,
  serializeScrubPatterns,
  serializeStyleProfile,
  serializeValidatorConfig,
} from "@/lib/settings/generation-config";
import { SETTING_KEYS } from "@/lib/settings/keys";

// Las claves implicadas en estas pruebas, para limpiarlas entre casos.
const KEYS = [
  SETTING_KEYS.maxHumanizeRetries,
  SETTING_KEYS.aiScoreThreshold,
  SETTING_KEYS.scrubPatterns,
  SETTING_KEYS.styleProfile,
  SETTING_KEYS.legacyEditorialVoice,
  SETTING_KEYS.legacySeoRules,
  SETTING_KEYS.validatorConfig,
  SETTING_KEYS.aiMaxRetries,
  SETTING_KEYS.aiTimeoutMs,
];

afterEach(async () => {
  await prisma.appSetting.deleteMany({ where: { key: { in: KEYS } } });
});

describe("getGenerationConfig — parámetros del bucle de calidad y limpieza", () => {
  it("usa los valores de fábrica cuando no hay nada configurado", async () => {
    const cfg = await getGenerationConfig();
    expect(cfg.maxHumanizeRetries).toBe(DEFAULT_PIPELINE_PARAMS.maxHumanizeRetries);
    expect(cfg.aiScoreThreshold).toBe(DEFAULT_PIPELINE_PARAMS.aiScoreThreshold);
    expect(cfg.scrubPatterns).toEqual([...DEFAULT_SCRUB_PATTERNS]);
    expect(cfg.aiMaxRetries).toBe(DEFAULT_PIPELINE_PARAMS.aiMaxRetries);
    expect(cfg.aiTimeoutMs).toBe(DEFAULT_PIPELINE_PARAMS.aiTimeoutMs);
  });

  it("acota aiScoreThreshold al rango 0-100 y maxHumanizeRetries al rango 0-5", async () => {
    await setAppSetting(SETTING_KEYS.aiScoreThreshold, "999");
    await setAppSetting(SETTING_KEYS.maxHumanizeRetries, "999");
    const cfg = await getGenerationConfig();
    expect(cfg.aiScoreThreshold).toBe(100);
    expect(cfg.maxHumanizeRetries).toBe(5);
  });

  it("acota la resiliencia de IA: reintentos a 0-5 y timeout a 10s-5min", async () => {
    await setAppSetting(SETTING_KEYS.aiMaxRetries, "99");
    await setAppSetting(SETTING_KEYS.aiTimeoutMs, "1"); // por debajo del mínimo
    const cfg = await getGenerationConfig();
    expect(cfg.aiMaxRetries).toBe(5);
    expect(cfg.aiTimeoutMs).toBe(10_000);
  });

  it("parsea los patrones de limpieza desde el textarea (uno por línea)", async () => {
    await setAppSetting(SETTING_KEYS.scrubPatterns, "según las fuentes\n  tras investigar  \n");
    const cfg = await getGenerationConfig();
    expect(cfg.scrubPatterns).toEqual([
      { pattern: "según las fuentes", replacement: "" },
      { pattern: "tras investigar", replacement: "" },
    ]);
  });

  it("un valor vacío desactiva la limpieza (no recae en los de fábrica)", async () => {
    await setAppSetting(SETTING_KEYS.scrubPatterns, "");
    const cfg = await getGenerationConfig();
    expect(cfg.scrubPatterns).toEqual([]);
  });

  it("serializeScrubPatterns hace el viaje de ida y vuelta", async () => {
    const text = serializeScrubPatterns([...DEFAULT_SCRUB_PATTERNS]);
    await setAppSetting(SETTING_KEYS.scrubPatterns, text);
    const cfg = await getGenerationConfig();
    expect(cfg.scrubPatterns).toEqual([...DEFAULT_SCRUB_PATTERNS]);
  });
});

describe("getStyleProfile — perfil de estilo editorial", () => {
  it("siembra el perfil con las claves heredadas (voz plana + reglas SEO)", async () => {
    await setAppSetting(SETTING_KEYS.legacyEditorialVoice, "Tono histórico");
    await setAppSetting(SETTING_KEYS.legacySeoRules, "Keyword en el H1");
    const profile = await getStyleProfile();
    expect(profile.brandVoice).toBe("Tono histórico");
    expect(profile.seoRules).toBe("Keyword en el H1");
    expect(profile.geoRules).toBe("");
  });

  it("hace el viaje de ida y vuelta del perfil estructurado", async () => {
    const profile = {
      ...EMPTY_STYLE_PROFILE,
      brandVoice: "Cercano",
      geoRules: "Responde preguntas directas",
      forbiddenWords: ["en conclusión"],
      fewShotExamples: ["Un ejemplo."],
    };
    await setAppSetting(SETTING_KEYS.styleProfile, serializeStyleProfile(profile));
    expect(await getStyleProfile()).toEqual(profile);
  });

  it("el perfil estructurado tiene prioridad sobre las claves heredadas", async () => {
    await setAppSetting(SETTING_KEYS.legacyEditorialVoice, "Vieja voz");
    await setAppSetting(
      SETTING_KEYS.styleProfile,
      serializeStyleProfile({ ...EMPTY_STYLE_PROFILE, brandVoice: "Voz nueva" }),
    );
    const profile = await getStyleProfile();
    expect(profile.brandVoice).toBe("Voz nueva");
  });
});

describe("getValidatorConfig — validador editorial determinista", () => {
  it("devuelve la configuración de fábrica cuando no hay nada guardado", async () => {
    expect(await getValidatorConfig()).toEqual(DEFAULT_VALIDATOR_CONFIG);
  });

  it("hace el viaje de ida y vuelta de la configuración guardada", async () => {
    const config = {
      forbiddenWords: { enabled: false, severity: "warning" as const },
      aiPatterns: { enabled: true, severity: "error" as const, patterns: ["foo"] },
      sourceOverlap: { enabled: true, severity: "warning" as const, minPhraseWords: 10 },
    };
    await setAppSetting(SETTING_KEYS.validatorConfig, serializeValidatorConfig(config));
    expect(await getValidatorConfig()).toEqual(config);
  });

  it("cae a la configuración de fábrica si el JSON es inválido", async () => {
    await setAppSetting(SETTING_KEYS.validatorConfig, "no es json");
    expect(await getValidatorConfig()).toEqual(DEFAULT_VALIDATOR_CONFIG);
  });
});
