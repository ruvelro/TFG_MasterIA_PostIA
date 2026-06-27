import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { setAppSetting } from "@/lib/settings/app-config";
import { SETTING_KEYS } from "@/lib/settings/keys";
import {
  DEFAULT_LENGTH_PRESETS,
  getLengthPresets,
  resolveLengthPreset,
  serializeLengthPresets,
} from "@/lib/settings/length-presets";

afterEach(async () => {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.lengthPresets } });
});

describe("catálogo de presets de longitud", () => {
  it("devuelve el catálogo de fábrica cuando no hay nada guardado", async () => {
    expect(await getLengthPresets()).toEqual(DEFAULT_LENGTH_PRESETS);
  });

  it("hace el viaje de ida y vuelta del catálogo guardado", async () => {
    const custom = [{ id: "tuit", label: "Tuit", minWords: 20, maxWords: 60 }];
    await setAppSetting(SETTING_KEYS.lengthPresets, serializeLengthPresets(custom));
    expect(await getLengthPresets()).toEqual(custom);
  });

  it("cae al catálogo de fábrica si el JSON es inválido o está vacío", async () => {
    await setAppSetting(SETTING_KEYS.lengthPresets, "[]");
    expect(await getLengthPresets()).toEqual(DEFAULT_LENGTH_PRESETS);
    await setAppSetting(SETTING_KEYS.lengthPresets, "no es json");
    expect(await getLengthPresets()).toEqual(DEFAULT_LENGTH_PRESETS);
  });

  it("resolveLengthPreset devuelve el preset por id, o undefined si no existe/no se indica", async () => {
    expect((await resolveLengthPreset("extenso"))?.id).toBe("extenso");
    expect(await resolveLengthPreset("no-existe")).toBeUndefined();
    expect(await resolveLengthPreset(undefined)).toBeUndefined();
  });
});
