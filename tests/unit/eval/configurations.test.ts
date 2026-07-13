import { describe, expect, it } from "vitest";

import { CAPABLE_MODEL, ECONOMY_MODEL, findConfiguration } from "@/lib/eval/configurations";
import { AI_STAGE_IDS, type StepConfig } from "@/lib/pipeline/default-config";
import type { ResolvedPipelineConfig } from "@/lib/pipeline/types";

const BASE_MODEL = "base/model";

/**
 * Config base mínima: todas las etapas con el mismo modelo para detectar qué variante cambia qué.
 * Solo interesan `steps` (y algún escalar), así que el resto se completa con un cast: las variantes
 * bajo prueba no leen validatorConfig ni el perfil de estilo.
 */
function makeBaseConfig(): ResolvedPipelineConfig {
  const steps = Object.fromEntries(
    AI_STAGE_IDS.map((id) => [id, { model: BASE_MODEL, prompt: "p" } satisfies StepConfig]),
  ) as ResolvedPipelineConfig["steps"];
  return {
    steps,
    sourceCount: 3,
    queryExpansionModel: "",
    maxFixIterations: 2,
  } as ResolvedPipelineConfig;
}

describe("configuraciones de evaluación por etapa", () => {
  it("'economico' fuerza el modelo económico en TODAS las etapas de IA", () => {
    const config = findConfiguration("economico");
    const result = config?.apply(makeBaseConfig());
    for (const id of AI_STAGE_IDS) {
      expect(result?.steps[id].model).toBe(ECONOMY_MODEL);
    }
  });

  it("'juez-capaz' sube SOLO las etapas juez, dejando el resto en el modelo base", () => {
    const result = findConfiguration("juez-capaz")?.apply(makeBaseConfig());
    const judge = ["validate", "factual-review", "quality-review"] as const;
    for (const id of judge) {
      expect(result?.steps[id].model).toBe(CAPABLE_MODEL);
    }
    // Una etapa no-juez conserva el modelo base.
    expect(result?.steps.draft.model).toBe(BASE_MODEL);
    expect(result?.steps.extract.model).toBe(BASE_MODEL);
  });

  it("'draft-capaz' sube SOLO la redacción", () => {
    const result = findConfiguration("draft-capaz")?.apply(makeBaseConfig());
    expect(result?.steps.draft.model).toBe(CAPABLE_MODEL);
    expect(result?.steps.validate.model).toBe(BASE_MODEL);
  });

  it("'apply' no muta la configuración base recibida", () => {
    const base = makeBaseConfig();
    findConfiguration("juez-capaz")?.apply(base);
    expect(base.steps.validate.model).toBe(BASE_MODEL);
  });
});
