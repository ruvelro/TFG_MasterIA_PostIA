import { GeneratorClient } from "./generator-client";

// Página del generador. La protección de sesión la aplica el layout de (app); aquí solo se
// monta la experiencia cliente, que conversa con el endpoint de generación en streaming.
export default function GeneratePage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Generar artículo</h1>
        <p className="text-muted mt-1 text-sm">
          Escribe un tema y el pipeline investigará, redactará, validará y corregirá el artículo.
        </p>
      </div>

      <GeneratorClient />
    </section>
  );
}
