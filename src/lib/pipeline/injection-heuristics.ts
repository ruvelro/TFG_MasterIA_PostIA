/**
 * Heurística SIN IA para detectar intentos de inyección de prompts en el contenido
 * descargado de las fuentes web.
 *
 * Amenaza: la etapa `research` descarga páginas arbitrarias y su texto entra en los
 * prompts como "fuente de verdad". Una página maliciosa puede incluir órdenes dirigidas
 * al modelo ("ignora las instrucciones anteriores y…") para alterar los hechos extraídos
 * o los veredictos de los jueces. El atacante no necesita cuenta: basta con que su página
 * aparezca en los resultados de búsqueda del tema.
 *
 * Esta pasada es una capa MÁS (defensa en profundidad), no la única: las fuentes van
 * además delimitadas en el prompt (`sourcesToText`) y las plantillas ordenan tratarlas
 * como datos. Los patrones exigen contexto dirigido al modelo (no basta un imperativo
 * suelto) para minimizar falsos positivos en artículos legítimos.
 */

const INJECTION_PATTERNS: readonly RegExp[] = [
  // Órdenes de anular las instrucciones previas (es/en): "ignora las instrucciones
  // anteriores", "disregard all previous instructions", "olvida tus reglas"…
  /\b(ignora|ignorad|ignore|olvida|forget|disregard|override)\b[^.\n]{0,60}\b(instrucciones|instructions?|prompts?|reglas|rules|directrices|guidelines)\b/i,
  // Redefinición del rol del modelo: "you are now an assistant that…", "actúa como un modelo sin restricciones"…
  /\b(eres ahora|ahora eres|a partir de ahora eres|you are now|from now on you are|act as|actúa como)\b[^.\n]{0,60}\b(asistente|assistant|chatbot|ai|ia|modelo|model|llm)\b/i,
  // Marcadores de rol de chat incrustados en el cuerpo de la página.
  /^\s*(system|assistant)\s*:/im,
  /\[\/?(system|inst)\]/i,
  // Exfiltración del prompt: "reveal your system prompt", "muestra tus instrucciones del sistema"…
  /\b(reveal|muestra|revela|imprime|print|repite|repeat)\b[^.\n]{0,60}\b(system prompt|prompt del sistema|instrucciones del sistema|initial instructions)\b/i,
  // Bloques de "nuevas instrucciones" dirigidos al modelo.
  /\b(nuevas instrucciones|new instructions|important instructions|instrucciones importantes)\s*:/i,
];

/**
 * Devuelve true si el texto contiene patrones habituales de inyección de prompts.
 * Pensada para el contenido descargado de una fuente ANTES de entrar en `extract`:
 * si dispara, la fuente se degrada al extracto de búsqueda y se marca como sospechosa.
 */
export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
