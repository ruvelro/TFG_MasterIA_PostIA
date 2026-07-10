import { z } from "zod";

import {
  ArticleEnrichmentSchema,
  BlueprintSchema,
  FactsSchema,
  FactualReviewSchema,
  FixerOutputSchema,
  LengthPresetSchema,
  NewsTypeSchema,
  QualityReviewSchema,
  ValidationReportSchema,
} from "@/lib/pipeline/schemas";
import type { PipelineContext } from "@/lib/pipeline/types";

/**
 * Esquema Zod del `PipelineContext` serializado en `GenerationRun.contextJson`.
 *
 * El contexto se persiste (JSON) para poder PAUSAR y REANUDAR una generación, y para la
 * revisión dirigida. Al rehidratarlo NO basta con un `JSON.parse(... as PipelineContext)`:
 * eso confía a ciegas en datos que viven en la BD y que pueden ser de una versión anterior
 * del esquema. Validamos con Zod (regla del proyecto: validar TODA entrada) para fallar con
 * un mensaje claro en lugar de romper de forma opaca en una etapa posterior.
 *
 * Reutiliza los esquemas de las salidas de etapa (`FactsSchema`, `BlueprintSchema`…) para que
 * el contrato del contexto no se duplique ni se desincronice de las etapas que lo rellenan.
 */
const SourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  // Contenido descargado (la "fuente de verdad"). Opcional para tolerar fuentes sin cuerpo.
  content: z.string().default(""),
  // Marcada por la heurística anti-inyección de research (contenido degradado al extracto).
  suspicious: z.boolean().optional(),
});

export const PipelineContextSchema = z.object({
  topic: z.string(),
  sources: z.array(SourceSchema),
  newsType: NewsTypeSchema.optional(),
  lengthPreset: LengthPresetSchema.optional(),
  revisionInstructions: z.string().optional(),
  context: z.string().optional(),
  language: z.string().optional(),
  parentArticleId: z.string().optional(),
  pauseForBlueprintReview: z.boolean().optional(),
  facts: FactsSchema.optional(),
  blueprint: BlueprintSchema.optional(),
  draft: z.string().optional(),
  report: ValidationReportSchema.optional(),
  factualReport: FactualReviewSchema.optional(),
  qualityReport: QualityReviewSchema.optional(),
  humanizeAttempts: z.number().int().optional(),
  article: FixerOutputSchema.optional(),
  enrichment: ArticleEnrichmentSchema.optional(),
  featuredImagePath: z.string().optional(),
});

/**
 * Deserializa y valida el contexto guardado de una generación. Lanza un error claro si el
 * JSON está corrupto o no encaja con el esquema (p. ej. un run de una versión incompatible),
 * en vez de propagar un objeto malformado al orquestador.
 */
export function parsePipelineContext(json: string): PipelineContext {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("El contexto de la generación está corrupto (JSON inválido)");
  }

  const parsed = PipelineContextSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues[0];
    const path = detail.path.join(".") || "(raíz)";
    throw new Error(
      `El contexto de la generación es inválido o de una versión incompatible: ${path} — ${detail.message}`,
    );
  }
  // El esquema reutiliza los contratos de etapa, así que la inferencia coincide con PipelineContext.
  return parsed.data as PipelineContext;
}
