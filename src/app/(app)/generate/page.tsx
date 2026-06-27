import { getLengthPresets } from "@/lib/settings/length-presets";
import { getNewsTypes } from "@/lib/settings/news-types";

import { GeneratorClient } from "./generator-client";

// Página del generador. La protección de sesión la aplica el layout de (app); aquí solo se
// monta la experiencia cliente, que conversa con el endpoint de generación en streaming.
export default async function GeneratePage() {
  // Los catálogos (tipos de noticia y presets de longitud) se resuelven en el servidor.
  const [newsTypes, lengthPresets] = await Promise.all([getNewsTypes(), getLengthPresets()]);
  const options = newsTypes.map((t) => ({ id: t.id, label: t.label, description: t.description }));
  const lengthOptions = lengthPresets.map((p) => ({
    id: p.id,
    label: p.label,
    minWords: p.minWords,
    maxWords: p.maxWords,
  }));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Generar artículo</h1>
        <p className="text-muted mt-1 text-sm">
          Escribe un tema y el pipeline investigará, redactará, validará y corregirá el artículo.
        </p>
      </div>

      <GeneratorClient newsTypes={options} lengthPresets={lengthOptions} />
    </section>
  );
}
