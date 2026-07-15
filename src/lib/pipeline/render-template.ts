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
  if (!text) return prompt;

  const payload = template.includes("{{context}}")
    ? ""
    : `\nContexto aportado:\n<contexto-usuario>\n${text}\n</contexto-usuario>`;
  return `${prompt}\n\nCONTRATO DE CONTEXTO DEL USUARIO (OBLIGATORIO):
- Los datos y las URLs aportados por el usuario tienen prioridad factual máxima dentro de esta
  generación. Contrástalos y amplíalos con la investigación, pero no los descartes ni los
  rebajes por ausencia en otras fuentes.
- Cumple las instrucciones editoriales del contexto en todo lo que produzcas o evalúes.
- No conviertas el contexto ni sus URLs en atribuciones visibles salvo que se pida expresamente
  o que la atribución a una fuente original sea imprescindible.${payload}`;
}

/**
 * Hace obligatoria la voz editorial incluso cuando una plantilla personalizada omite su marcador.
 * El contrato se añade siempre: así un juez o corrector no puede sacrificar la identidad del medio
 * para satisfacer una sugerencia SEO o una heurística de estilo genérica.
 */
export function appendEditorialVoice(
  prompt: string,
  template: string,
  editorialVoice?: string,
): string {
  const voice = editorialVoice?.trim();
  if (!voice || voice === "(sin perfil de estilo configurado)") return prompt;

  const payload = template.includes("{{editorialVoice}}")
    ? ""
    : `\nVoz editorial configurada:\n<voz-editorial>\n${voice}\n</voz-editorial>`;
  return `${prompt}\n\nCONTRATO DE VOZ EDITORIAL (OBLIGATORIO):
- Conserva la voz, las reglas de casa, el registro regional y las palabras prohibidas durante
  cualquier redacción, reescritura o evaluación.
- La voz editorial prevalece sobre recomendaciones SEO/GEO o correcciones genéricas de estilo
  que la contradigan.${payload}`;
}

/** Lista los nombres de marcador presentes en una plantilla (sin duplicados). Útil para la UI. */
export function findPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_REGEX)) {
    found.add(match[1]);
  }
  return [...found];
}
