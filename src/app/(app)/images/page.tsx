import { listArticlesByUser } from "@/lib/articles/repository";
import { requireSession } from "@/lib/auth/authorize";
import { listImagesByUser } from "@/lib/images/repository";
import { DEFAULT_FEATURE_IMAGE_MODEL, getGenerationConfig } from "@/lib/settings/generation-config";
import { getImageStyles } from "@/lib/settings/image-styles";

import { ImagesClient } from "./images-client";

// Generador de imágenes independiente. La protección de sesión la aplica el layout de (app);
// aquí se resuelven en el servidor el modelo por defecto, los estilos, y —para la galería y la
// asignación como destacada— las imágenes y los artículos del usuario.
export default async function ImagesPage() {
  const session = await requireSession();

  const [generation, styles, images, articles] = await Promise.all([
    getGenerationConfig(),
    getImageStyles(),
    listImagesByUser(session.user.id),
    listArticlesByUser(session.user.id),
  ]);

  const defaultModel =
    generation.featureImageModel.length > 0
      ? generation.featureImageModel
      : DEFAULT_FEATURE_IMAGE_MODEL;

  const styleOptions = styles.map((s) => ({ id: s.id, label: s.label }));
  const galleryImages = images.map((i) => ({
    id: i.id,
    prompt: i.prompt,
    styleId: i.styleId,
    model: i.model,
  }));
  const articleOptions = articles.map((a) => ({ id: a.id, title: a.title }));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Generar imágenes</h1>
        <p className="text-muted mt-1 text-sm">
          Crea imágenes sueltas —destacadas, de relleno o genéricas— con el modelo, el prompt y el
          estilo que elijas. Se guardan en tu galería y puedes usarlas como imagen destacada de un
          artículo. Los estilos se configuran en el panel de administración.
        </p>
      </div>

      <ImagesClient
        defaultModel={defaultModel}
        styles={styleOptions}
        articles={articleOptions}
        initialImages={galleryImages}
      />
    </section>
  );
}
