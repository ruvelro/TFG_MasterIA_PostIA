import Link from "next/link";

import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

// Landing pública de presentación del producto. Es estática (Server Component): presenta
// PostIA, sus capacidades y el pipeline —tomado de la única fuente de verdad
// `PIPELINE_STAGES`— y dirige a registro / inicio de sesión.

// ── Iconos en línea (stroke = currentColor) para no depender de librerías externas ──────
type IconProps = { className?: string };

function IconLayers({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="m12 3 9 5-9 5-9-5 9-5Z" strokeLinejoin="round" />
      <path d="m3 13 9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}
function IconPen({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGauge({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M12 14a9 9 0 1 0-7.5-4" strokeLinecap="round" />
      <path d="M12 14 16 9" strokeLinecap="round" />
      <path d="M4.5 10H2M22 10h-2.5M12 21v2" strokeLinecap="round" />
    </svg>
  );
}
function IconGlobe({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}
function IconRefresh({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.4" strokeLinecap="round" />
      <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  {
    Icon: IconLayers,
    title: "Pipeline multi-etapa",
    description:
      "Once etapas encadenadas —de la investigación a la meta SEO— y un modelo distinto por paso vía OpenRouter, para usar el mejor LLM en cada tarea.",
  },
  {
    Icon: IconPen,
    title: "Identidad editorial entrenable",
    description:
      "Define la voz de tu marca a mano o entrénala automáticamente a partir de tus propias URLs. PostIA imita tu estilo, no uno genérico.",
  },
  {
    Icon: IconShield,
    title: "Fidelidad verificada",
    description:
      "Investiga fuentes reales y revisa cada afirmación (confirmada, dudosa o descartada). Las palabras de la IA y la copia literal se detectan solas.",
  },
  {
    Icon: IconGauge,
    title: "Calidad medible y anti-IA",
    description:
      "Puntuaciones de estructura, soporte factual y SEO, más un detector de tono IA que dispara una re-humanización automática del texto.",
  },
  {
    Icon: IconGlobe,
    title: "SEO y GEO, listo para publicar",
    description:
      "Optimización para buscadores y para motores generativos, con meta description, keywords, titulares alternativos, FAQ y JSON-LD Schema.org.",
  },
  {
    Icon: IconRefresh,
    title: "Revisión dirigida",
    description:
      "¿Algo que cambiar? Reedita cualquier artículo con instrucciones y se regenera sin volver a investigar, reaprovechando todo el trabajo previo.",
  },
];

const FAQS = [
  {
    q: "¿Qué es PostIA?",
    a: "Un generador de artículos de blog que orquesta varios modelos de IA en un pipeline por etapas: investiga, estructura, redacta, valida, corrige y prepara el SEO. Es un Trabajo de Fin de Máster centrado en las buenas prácticas, no solo en que funcione.",
  },
  {
    q: "¿Los artículos están respaldados por fuentes?",
    a: "Sí. La etapa de investigación descarga fuentes reales que son la «fuente de verdad», y una revisión factual comprueba cada afirmación frente a ellas antes de dar el artículo por bueno.",
  },
  {
    q: "¿Puedo adaptar el estilo a mi marca?",
    a: "Totalmente. Configuras un perfil editorial (voz, reglas de casa, E-E-A-T, palabras prohibidas, ejemplos) a mano, o lo entrenas pegando URLs de artículos que representen tu estilo y dejando que la IA lo extraiga.",
  },
  {
    q: "¿Necesito claves de API?",
    a: "Sí: una de OpenRouter para los modelos y otra de un proveedor de búsqueda (Tavily o Google CSE). Se configuran en el panel de administración y se guardan cifradas en reposo.",
  },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="bg-primary flex size-7 items-center justify-center rounded-lg text-sm font-bold text-white">
        P
      </span>
      <span className="text-lg">PostIA</span>
    </span>
  );
}

export default function HomePage() {
  const navLinkClass = "text-muted hover:text-foreground transition-colors";
  const ghostButton =
    "border-muted/30 hover:border-muted/60 rounded-lg border px-4 py-2 text-sm font-medium transition-colors";
  const primaryButton =
    "bg-primary rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90";

  return (
    <div className="flex flex-1 flex-col">
      {/* ── Barra de navegación ───────────────────────────────────────────── */}
      <header className="border-muted/15 bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" aria-label="PostIA — inicio">
            <Logo />
          </Link>

          <div className="hidden items-center gap-7 text-sm md:flex">
            <a href="#caracteristicas" className={navLinkClass}>
              Características
            </a>
            <a href="#pipeline" className={navLinkClass}>
              Cómo funciona
            </a>
            <a href="#faq" className={navLinkClass}>
              Preguntas
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className={ghostButton}>
              Iniciar sesión
            </Link>
            <Link href="/register" className={primaryButton}>
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex flex-col">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Resplandor decorativo del fondo. */}
          <div
            aria-hidden
            className="bg-primary/20 pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-3xl"
          />
          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
            <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Trabajo de Fin de Máster · IA generativa
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              De un tema a un artículo <span className="text-primary">publicable</span>, sin atajos.
            </h1>
            <p className="text-muted max-w-2xl text-lg">
              PostIA convierte una idea en un artículo de blog con respaldo en fuentes, voz de marca
              propia y SEO listo para publicar — mediante un pipeline de IA multi-etapa, con un
              modelo distinto por paso.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="bg-primary rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Empezar gratis
              </Link>
              <a
                href="#pipeline"
                className="border-muted/30 hover:border-muted/60 rounded-lg border px-6 py-3 font-medium transition-colors"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="text-muted text-sm">
              Registro abierto · Acceso con contraseña fuerte o passkey
            </p>
          </div>
        </section>

        {/* ── Características ──────────────────────────────────────────────── */}
        <section id="caracteristicas" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Calidad editorial, por diseño</h2>
            <p className="text-muted mt-3 text-lg">
              No es un «escribe un artículo» a ciegas. Cada pieza pasa por investigación,
              verificación, control de calidad y limpieza antes de llegar a ti.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, description }) => (
              <article
                key={title}
                className="border-muted/15 hover:border-primary/40 bg-foreground/[0.015] flex flex-col gap-3 rounded-2xl border p-6 transition-colors"
              >
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <Icon className="size-6" />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── El pipeline ─────────────────────────────────────────────────── */}
        <section
          id="pipeline"
          className="border-muted/15 bg-foreground/[0.02] scroll-mt-20 border-y"
        >
          <div className="mx-auto w-full max-w-4xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-primary text-sm font-semibold tracking-wide uppercase">
                El pipeline
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                {PIPELINE_STAGES.length} etapas, cada una a lo suyo
              </h2>
              <p className="text-muted mt-3 text-lg">
                Una cadena transparente: ves en qué paso está cada generación y puedes pausar para
                revisar los hechos o la estructura.
              </p>
            </div>

            <ol className="mt-12 grid gap-4 sm:grid-cols-2">
              {PIPELINE_STAGES.map((stage, index) => (
                <li
                  key={stage.id}
                  className="border-muted/15 bg-background flex items-start gap-4 rounded-xl border p-4"
                >
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{stage.label}</h3>
                    <p className="text-muted mt-0.5 text-sm leading-relaxed">{stage.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Preguntas frecuentes ────────────────────────────────────────── */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="border-muted/15 hover:border-muted/30 group rounded-xl border p-5 transition-colors"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-muted mt-3 text-sm leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="bg-primary relative overflow-hidden rounded-3xl px-8 py-16 text-center text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -bottom-16 size-64 rounded-full bg-white/10 blur-2xl"
            />
            <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
              Genera tu primer artículo hoy
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/80">
              Crea tu cuenta, conecta tus claves y deja que el pipeline investigue, redacte y
              optimice por ti.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="text-primary rounded-lg bg-white px-6 py-3 font-semibold transition-opacity hover:opacity-90"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-white/40 px-6 py-3 font-medium transition-colors hover:bg-white/10"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-muted/15 border-t">
        <div className="text-muted mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm sm:flex-row">
          <Logo />
          <p>PostIA · Generador de artículos con IA · Trabajo de Fin de Máster</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
