import { describe, expect, it } from "vitest";

import {
  markPendingStagesAsSkipped,
  type StageMap,
} from "@/app/(app)/generate/use-generation-stream";
import { STAGE_IDS } from "@/lib/pipeline/stages";

describe("estado visual de etapas de generación", () => {
  it("marca como omitidas las etapas pendientes cuando el run termina", () => {
    const stages = Object.fromEntries(
      STAGE_IDS.map((id) => [id, { status: "pending", attempt: 0 }]),
    ) as StageMap;
    stages.research = { status: "done", attempt: 1 };
    stages.enrich = { status: "running", attempt: 1, model: "modelo/enrich" };

    const result = markPendingStagesAsSkipped(stages);

    expect(result.research).toEqual({ status: "done", attempt: 1 });
    expect(result.enrich).toEqual({ status: "running", attempt: 1, model: "modelo/enrich" });
    expect(result["feature-image"]).toEqual({ status: "skipped", attempt: 0 });
  });
});
