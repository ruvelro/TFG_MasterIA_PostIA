// Motor de plantillas mínimo para los prompts: sustituye marcadores `{{clave}}` por los
// valores del contexto. Deliberadamente simple (no es un lenguaje de plantillas completo)
// porque los prompts solo necesitan interpolar texto, y así evitamos dependencias y
// superficie de ataque (nada de evaluación de código).

const PLACEHOLDER_REGEX = /\{\{\s*([\w-]+)\s*\}\}/g;

export type TemplateContext = Record<string, string>;

/**
 * Renderiza una plantilla sustituyendo `{{clave}}` por `context[clave]`. Los marcadores
 * sin valor en el contexto se sustituyen por cadena vacía (un prompt no debe romperse por
 * una sección de contexto ausente).
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(PLACEHOLDER_REGEX, (_match, key: string) => context[key] ?? "");
}

/**
 * Garantiza que el contexto adicional del usuario llegue al prompt aunque la plantilla (editable
 * por el admin) no incluya el marcador `{{context}}`: si la plantilla no lo usa pero hay contexto,
 * lo anexa al final. Si la plantilla ya lo referencia, se respeta su posición y no se duplica.
 */
export function appendUserContext(prompt: string, template: string, context?: string): string {
  const text = context?.trim();
  if (!text || template.includes("{{context}}")) return prompt;
  return `${prompt}\n\nContexto adicional aportado por el usuario:\n${text}`;
}

/** Lista los nombres de marcador presentes en una plantilla (sin duplicados). Útil para la UI. */
export function findPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_REGEX)) {
    found.add(match[1]);
  }
  return [...found];
}
