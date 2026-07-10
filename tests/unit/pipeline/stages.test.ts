import { describe, expect, it } from "vitest";

import { PIPELINE_STAGES, STAGE_IDS } from "@/lib/pipeline/stages";

describe("catálogo de etapas del pipeline", () => {
  it("define las doce etapas en el orden esperado", () => {
    expect(STAGE_IDS).toEqual([
      "research",
      "extract",
      "blueprint",
      "draft",
      "humanize",
      "validate",
      "factual-review",
      "quality-review",
      "fixer",
      "scrub",
      "enrich",
      "feature-image",
    ]);
  });

  it("mantiene la metadata alineada con los identificadores de etapa", () => {
    // La metadata y los ids no deben desincronizarse: misma cantidad y mismo orden.
    expect(PIPELINE_STAGES.map((stage) => stage.id)).toEqual([...STAGE_IDS]);
  });

  it("marca research y scrub como las únicas etapas que no usan IA", () => {
    const withoutAi = PIPELINE_STAGES.filter((stage) => !stage.usesAi).map((s) => s.id);
    expect(withoutAi).toEqual(["research", "scrub"]);
  });

  it("da etiqueta y descripción no vacías a cada etapa", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(stage.label.trim().length).toBeGreaterThan(0);
      expect(stage.description.trim().length).toBeGreaterThan(0);
    }
  });
});
