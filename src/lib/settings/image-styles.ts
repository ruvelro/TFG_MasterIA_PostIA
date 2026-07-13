import { ImageStyleCatalogSchema, type ImageStyle } from "@/lib/pipeline/schemas";

import { getAppSetting } from "./app-config";
import { SETTING_KEYS } from "./keys";

/**
 * Catálogo de estilos del generador de imágenes independiente: modificadores estéticos que se
 * añaden al prompt del usuario (p. ej. "fotoperiodístico", "ilustración plana"). Se guarda como
 * JSON en `AppSetting` y el admin lo edita desde el panel. El primero ("Sin estilo") no aporta
 * sufijo, para permitir generar con el prompt tal cual.
 */

/** Catálogo de fábrica. Los sufijos van en inglés porque los modelos de imagen rinden mejor así. */
export const DEFAULT_IMAGE_STYLES: ImageStyle[] = [
  { id: "sin-estilo", label: "Sin estilo", promptSuffix: "" },
  {
    id: "fotoperiodistico",
    label: "Fotoperiodístico",
    promptSuffix:
      "editorial photojournalism, natural lighting, realistic, high detail, 35mm, no text, no logos",
  },
  {
    id: "ilustracion-plana",
    label: "Ilustración plana",
    promptSuffix:
      "flat vector illustration, clean shapes, limited palette, modern editorial style, no text",
  },
  {
    id: "render-3d",
    label: "Render 3D",
    promptSuffix: "high quality 3D render, soft studio lighting, subtle depth of field, no text",
  },
  {
    id: "minimalista",
    label: "Minimalista",
    promptSuffix: "minimalist composition, lots of negative space, muted tones, elegant, no text",
  },
  {
    id: "acuarela",
    label: "Acuarela",
    promptSuffix: "loose watercolor painting, soft washes, textured paper, artistic, no text",
  },
];

/** Devuelve el catálogo guardado, o el de fábrica si no hay nada/el JSON es inválido o vacío. */
export async function getImageStyles(): Promise<ImageStyle[]> {
  const raw = await getAppSetting(SETTING_KEYS.imageStyles);
  if (raw) {
    try {
      const parsed = ImageStyleCatalogSchema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // JSON corrupto: catálogo de fábrica en lugar de romper.
    }
  }
  return DEFAULT_IMAGE_STYLES;
}

/** Serializa el catálogo para persistirlo como JSON. */
export function serializeImageStyles(styles: ImageStyle[]): string {
  return JSON.stringify(styles);
}

/**
 * Resuelve el estilo seleccionado por id y devuelve su sufijo de prompt (cadena vacía si el id
 * no existe o el estilo no aporta sufijo). Se resuelve en el servidor para no confiar en un
 * sufijo enviado por el cliente.
 */
export async function resolveImageStyleSuffix(id: string | undefined): Promise<string> {
  if (!id) return "";
  const styles = await getImageStyles();
  return styles.find((s) => s.id === id)?.promptSuffix ?? "";
}
