import { z } from "zod";

/** Entrada de la creación de un lote de generación. */
export const createBatchSchema = z.object({
  name: z.string().trim().min(1, "El lote necesita un nombre").max(120),
  topics: z
    .array(z.string().trim().min(3, "Cada tema necesita al menos 3 caracteres").max(300))
    .min(1, "Añade al menos un tema")
    // Cota defensiva: un lote enorme monopolizaría el worker y el presupuesto.
    .max(50, "Máximo 50 temas por lote"),
  budgetUsd: z.number().min(0).max(1000).default(0),
  newsTypeId: z.string().trim().optional(),
});

export type CreateBatchBody = z.infer<typeof createBatchSchema>;
