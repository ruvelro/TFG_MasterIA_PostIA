import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { setAppSetting } from "@/lib/settings/app-config";
import { SETTING_KEYS } from "@/lib/settings/keys";
import {
  DEFAULT_NEWS_TYPES,
  getNewsTypes,
  resolveNewsType,
  serializeNewsTypes,
} from "@/lib/settings/news-types";

afterEach(async () => {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.newsTypes } });
});

describe("catálogo de tipos de noticia", () => {
  it("devuelve el catálogo de fábrica cuando no hay nada guardado", async () => {
    expect(await getNewsTypes()).toEqual(DEFAULT_NEWS_TYPES);
  });

  it("hace el viaje de ida y vuelta del catálogo guardado", async () => {
    const custom = [{ ...DEFAULT_NEWS_TYPES[0], id: "propio", label: "Propio" }];
    await setAppSetting(SETTING_KEYS.newsTypes, serializeNewsTypes(custom));
    expect(await getNewsTypes()).toEqual(custom);
  });

  it("cae al catálogo de fábrica si el JSON es inválido o está vacío", async () => {
    await setAppSetting(SETTING_KEYS.newsTypes, "[]");
    expect(await getNewsTypes()).toEqual(DEFAULT_NEWS_TYPES);
    await setAppSetting(SETTING_KEYS.newsTypes, "no es json");
    expect(await getNewsTypes()).toEqual(DEFAULT_NEWS_TYPES);
  });

  it("resolveNewsType devuelve el tipo por id, o el primero como predeterminado", async () => {
    expect((await resolveNewsType("analisis")).id).toBe("analisis");
    // Un id inexistente o ausente cae al primer tipo del catálogo.
    expect((await resolveNewsType("no-existe")).id).toBe(DEFAULT_NEWS_TYPES[0].id);
    expect((await resolveNewsType(undefined)).id).toBe(DEFAULT_NEWS_TYPES[0].id);
  });
});
