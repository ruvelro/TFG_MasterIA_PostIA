import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import {
  createGeneratedImage,
  deleteImageForUser,
  getImageForUser,
  listImagesByUser,
  setGeneratedImagePath,
} from "@/lib/images/repository";

let userId: string;
let otherUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Img User", email: `img_${Date.now()}@postia.test` },
  });
  const other = await prisma.user.create({
    data: { name: "Otro", email: `img_otro_${Date.now()}@postia.test` },
  });
  userId = user.id;
  otherUserId = other.id;
});

describe("repositorio de imágenes generadas", () => {
  it("crea, fija la ruta y lista las imágenes del usuario (más reciente primero)", async () => {
    const first = await createGeneratedImage({
      userId,
      prompt: "gato",
      styleId: null,
      model: "m/x",
      path: "",
      mediaType: "image/png",
    });
    await setGeneratedImagePath(first.id, `uploads/generated/${userId}/${first.id}.png`);
    const second = await createGeneratedImage({
      userId,
      prompt: "perro",
      styleId: "fotoperiodistico",
      model: "m/x",
      path: `uploads/generated/${userId}/segunda.png`,
      mediaType: "image/png",
    });

    const list = await listImagesByUser(userId);
    const ids = list.map((i) => i.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
    // La más reciente encabeza la lista.
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it("no deja leer una imagen de otro usuario", async () => {
    const mine = await createGeneratedImage({
      userId,
      prompt: "solo mía",
      styleId: null,
      model: "m/x",
      path: `uploads/generated/${userId}/mia.png`,
      mediaType: "image/png",
    });
    expect(await getImageForUser(mine.id, userId)).not.toBeNull();
    expect(await getImageForUser(mine.id, otherUserId)).toBeNull();
  });

  it("borra solo si es del usuario y devuelve la ruta del fichero", async () => {
    const img = await createGeneratedImage({
      userId,
      prompt: "borrar",
      styleId: null,
      model: "m/x",
      path: `uploads/generated/${userId}/borrar.png`,
      mediaType: "image/png",
    });

    // Un tercero no puede borrarla.
    expect(await deleteImageForUser(img.id, otherUserId)).toBeNull();
    // El propietario sí, y recupera la ruta para borrar el binario.
    expect(await deleteImageForUser(img.id, userId)).toBe(`uploads/generated/${userId}/borrar.png`);
    expect(await getImageForUser(img.id, userId)).toBeNull();
  });
});
