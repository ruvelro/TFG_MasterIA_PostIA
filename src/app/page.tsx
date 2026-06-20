import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

// Landing pública. Presenta el producto y enumera las etapas del pipeline tomándolas de
// la única fuente de verdad (`PIPELINE_STAGES`), para que la UI no se desincronice de la
// lógica cuando cambien las etapas.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <span className="text-primary text-sm font-semibold tracking-wide uppercase">
          Trabajo de Fin de Máster
        </span>
        <h1 className="text-4xl font-bold sm:text-5xl">
          PostIA — Generador de artículos de blog con IA
        </h1>
        <p className="text-muted text-lg">
          Convierte un tema en un artículo publicable mediante un pipeline de IA multi-etapa, con un
          modelo distinto por paso a través de OpenRouter.
        </p>
      </header>

      <section aria-labelledby="etapas" className="flex flex-col gap-4">
        <h2 id="etapas" className="text-xl font-semibold">
          El pipeline
        </h2>
        <ol className="flex flex-col gap-3">
          {PIPELINE_STAGES.map((stage, index) => (
            <li
              key={stage.id}
              className="border-muted/20 flex items-start gap-4 rounded-lg border p-4"
            >
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-semibold">
                {index + 1}
              </span>
              <div>
                <h3 className="font-medium">{stage.label}</h3>
                <p className="text-muted text-sm">{stage.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
