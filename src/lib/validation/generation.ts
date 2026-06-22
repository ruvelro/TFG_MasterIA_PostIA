import { z } from "zod";

import { AI_STAGE_IDS } from "@/lib/pipeline/default-config";
import { FactsSchema } from "@/lib/pipeline/schemas";

// Override opcional de una etapa para una generación concreta.
const stepOverrideSchema = z.object({
  model: z.string().max(100).optional(),
  prompt: z.string().max(20_000).optional(),
});

// `partialRecord`: en Zod 4 un `record` con clave enum exigiría TODAS las etapas; aquí los
// overrides son opcionales por etapa, así que usamos la variante parcial.
const overridesSchema = z.partialRecord(z.enum(AI_STAGE_IDS), stepOverrideSchema).optional();

/** Cuerpo del POST que inicia una generación. */
export const startGenerationSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, { error: "El tema debe tener al menos 5 caracteres" })
    .max(200, { error: "El tema es demasiado largo (máx. 200)" }),
  pauseForReview: z.boolean().default(true),
  overrides: overridesSchema,
});

/** Cuerpo del POST que reanuda una generación tras la revisión de hechos. */
export const resumeGenerationSchema = z.object({
  editedFacts: FactsSchema,
  overrides: overridesSchema,
});

export type StartGenerationInput = z.infer<typeof startGenerationSchema>;
export type ResumeGenerationInput = z.infer<typeof resumeGenerationSchema>;
