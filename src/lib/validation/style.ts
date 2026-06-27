import { z } from "zod";

import { MAX_ANALYZER_URLS } from "@/lib/settings/style-analyzer";

/**
 * Entrada del analizador de estilo. Las URLs se validan de forma laxa (cadenas no vacías):
 * la descarga es tolerante a fallos por URL, así que una entrada malformada no aborta el
 * análisis completo. Solo se acota el número total para limitar coste y latencia.
 */
export const analyzeStyleSchema = z.object({
  urls: z
    .array(z.string().trim().min(1))
    .min(1, "Indica al menos una URL")
    .max(MAX_ANALYZER_URLS, `Máximo ${MAX_ANALYZER_URLS} URLs por análisis`),
});

export type AnalyzeStyleInput = z.infer<typeof analyzeStyleSchema>;
