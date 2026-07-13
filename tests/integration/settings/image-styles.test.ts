import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { setAppSetting } from "@/lib/settings/app-config";
import {
  DEFAULT_IMAGE_STYLES,
  getImageStyles,
  resolveImageStyleSuffix,
  serializeImageStyles,
} from "@/lib/settings/image-styles";
import { SETTING_KEYS } from "@/lib/settings/keys";

afterEach(async () => {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.imageStyles } });
});

describe("catálogo de estilos de imagen", () => {
  it("devuelve el catálogo de fábrica cuando no hay nada guardado", async () => {
    expect(await getImageStyles()).toEqual(DEFAULT_IMAGE_STYLES);
  });

  it("hace el viaje de ida y vuelta del catálogo guardado", async () => {
    const custom = [{ id: "comic", label: "Cómic", promptSuffix: "comic book style, bold lines" }];
    await setAppSetting(SETTING_KEYS.imageStyles, serializeImageStyles(custom));
    expect(await getImageStyles()).toEqual(custom);
  });

  it("cae al catálogo de fábrica si el JSON es inválido o está vacío", async () => {
    await setAppSetting(SETTING_KEYS.imageStyles, "[]");
    expect(await getImageStyles()).toEqual(DEFAULT_IMAGE_STYLES);
    await setAppSetting(SETTING_KEYS.imageStyles, "no es json");
    expect(await getImageStyles()).toEqual(DEFAULT_IMAGE_STYLES);
  });

  it("resolveImageStyleSuffix devuelve el sufijo por id, o vacío si no existe/no se indica", async () => {
    expect(await resolveImageStyleSuffix("fotoperiodistico")).toContain("photojournalism");
    // "Sin estilo" existe pero su sufijo es vacío por diseño.
    expect(await resolveImageStyleSuffix("sin-estilo")).toBe("");
    expect(await resolveImageStyleSuffix("no-existe")).toBe("");
    expect(await resolveImageStyleSuffix(undefined)).toBe("");
  });
});
