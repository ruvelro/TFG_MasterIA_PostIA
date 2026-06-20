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

/** Lista los nombres de marcador presentes en una plantilla (sin duplicados). Útil para la UI. */
export function findPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_REGEX)) {
    found.add(match[1]);
  }
  return [...found];
}
