/**
 * Conjunto dorado del harness de evaluación: temas FIJOS y variados sobre los que se
 * ejecuta el pipeline bajo distintas configuraciones. Que sean fijos es lo que hace las
 * ejecuciones comparables entre sí (misma entrada, distinta configuración).
 *
 * La selección busca variedad de dominio (tecnología, ciencia, economía, sociedad) y de
 * dificultad factual (temas estables vs. temas con cifras que exigen fuentes frescas).
 */
export interface GoldenTopic {
  id: string;
  topic: string;
}

export const GOLDEN_TOPICS: readonly GoldenTopic[] = [
  {
    id: "ia-regulacion-ue",
    topic: "El reglamento europeo de inteligencia artificial y sus plazos de aplicación",
  },
  {
    id: "baterias-estado-solido",
    topic: "Baterías de estado sólido: estado actual y fecha esperada en coches eléctricos",
  },
  {
    id: "teletrabajo-productividad",
    topic: "Qué dice la evidencia sobre teletrabajo y productividad",
  },
  {
    id: "vivienda-alquiler-espana",
    topic: "Evolución del precio del alquiler en España y medidas públicas recientes",
  },
  {
    id: "vacunas-arn-gripe",
    topic: "Vacunas de ARN mensajero contra la gripe: ensayos y calendario previsto",
  },
  {
    id: "computacion-cuantica-errores",
    topic: "Corrección de errores en computación cuántica: últimos avances",
  },
  {
    id: "energia-solar-espana",
    topic: "El crecimiento de la energía solar fotovoltaica en España",
  },
  {
    id: "ciberataques-ransomware",
    topic: "Tendencias del ransomware y recomendaciones para pymes",
  },
  {
    id: "james-webb-exoplanetas",
    topic: "Descubrimientos del telescopio James Webb sobre atmósferas de exoplanetas",
  },
  {
    id: "semiconductores-europa",
    topic: "La estrategia europea de semiconductores y sus fábricas anunciadas",
  },
  {
    id: "obesidad-farmacos-glp1",
    topic: "Fármacos GLP-1 para la obesidad: eficacia, riesgos y acceso",
  },
  {
    id: "streaming-consolidacion",
    topic: "La consolidación del mercado del streaming y su efecto en los precios",
  },
] as const;
