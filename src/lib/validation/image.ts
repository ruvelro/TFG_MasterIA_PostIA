import { z } from "zod";

/**
 * Entrada del generador de imágenes independiente. El `styleId` se resuelve a un sufijo de
 * prompt EN EL SERVIDOR (no se confía en un sufijo que venga del cliente). El prompt se limita
 * para no enviar cargas desproporcionadas al modelo.
 */
export const generateImageSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1, "Describe la imagen que quieres generar").max(4000),
  styleId: z.string().max(100).optional(),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;
