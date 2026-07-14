import { z } from "zod";

function extractJsonCandidate(text: string): string | null {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenceMatch?.[1] ?? cleaned;
  const start = source.search(/[\[{]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char !== "}" && char !== "]") continue;

    const opening = stack.pop();
    const expected = opening === "{" ? "}" : "]";
    if (char !== expected) return null;
    if (stack.length === 0) return source.slice(start, index + 1);
  }

  return null;
}

function normalizeJsonCandidate(candidate: string): string[] {
  const normalized = candidate
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
  return normalized === candidate ? [candidate] : [candidate, normalized];
}

export async function repairStructuredObjectText(options: {
  text: string;
}): Promise<string | null> {
  const candidate = extractJsonCandidate(options.text);
  if (!candidate) return null;

  for (const attempt of normalizeJsonCandidate(candidate)) {
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      // Probamos la siguiente normalización antes de delegar la regeneración al modelo.
    }
  }

  return null;
}

export async function parseStructuredObjectFromText<T>(params: {
  text: string;
  schema: z.ZodType<T>;
}): Promise<T | null> {
  const repaired = await repairStructuredObjectText({ text: params.text });
  if (!repaired) return null;

  const parsed = JSON.parse(repaired) as unknown;
  const validation = await params.schema.safeParseAsync(parsed);
  return validation.success ? validation.data : null;
}

/**
 * El fallback usa texto libre a propósito: evita repetir el mismo mecanismo de structured
 * outputs que acaba de fallar, pero conserva el contrato incluyendo el JSON Schema completo.
 */
export function buildStructuredRecoveryPrompt<T>(params: {
  prompt: string;
  schema: z.ZodType<T>;
  attempt: number;
}): string {
  const jsonSchema = JSON.stringify(z.toJSONSchema(params.schema), null, 2);

  return [
    params.prompt,
    "",
    `RECUPERACIÓN DE SALIDA ESTRUCTURADA (intento ${params.attempt}):`,
    "La respuesta previa no era JSON válido o no cumplía el contrato.",
    "Resuelve de nuevo la tarea y devuelve ÚNICAMENTE un objeto JSON válido.",
    "No uses Markdown, comentarios ni texto antes o después del objeto.",
    "Incluye todos los campos required, respeta sus tipos y enums, usa comillas dobles y",
    "no incluyas trailing commas. Este es el JSON Schema exacto que debes cumplir:",
    "",
    jsonSchema,
  ].join("\n");
}
