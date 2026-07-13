import { DEFAULT_FEATURE_IMAGE_MODEL, getGenerationConfig } from "@/lib/settings/generation-config";
import { getImageStyles } from "@/lib/settings/image-styles";

import { ImagesClient } from "./images-client";

// Generador de imágenes independiente. La protección de sesión la aplica el layout de (app);
// aquí se resuelven en el servidor el modelo de imagen por defecto y el catálogo de estilos.
export default async function ImagesPage() {
  const [generation, styles] = await Promise.all([getGenerationConfig(), getImageStyles()]);
  const defaultModel =
    generation.featureImageModel.length > 0
      ? generation.featureImageModel
      : DEFAULT_FEATURE_IMAGE_MODEL;

  const styleOptions = styles.map((s) => ({ id: s.id, label: s.label }));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Generar imágenes</h1>
        <p className="text-muted mt-1 text-sm">
          Crea imágenes sueltas —destacadas, de relleno o genéricas— con el modelo, el prompt y el
          estilo que elijas. Los estilos se configuran en el panel de administración.
        </p>
      </div>

      <ImagesClient defaultModel={defaultModel} styles={styleOptions} />
    </section>
  );
}
