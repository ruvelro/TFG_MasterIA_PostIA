import { beforeAll, describe, expect, it } from "vitest";

import {
  deleteArticleForUser,
  getArticleForUser,
  listArticlesByUser,
} from "@/lib/articles/repository";
import { prisma } from "@/lib/db/client";

let ownerId: string;
let strangerId: string;

beforeAll(async () => {
  const [owner, stranger] = await Promise.all([
    prisma.user.create({ data: { name: "Owner", email: `owner_${Date.now()}@postia.test` } }),
    prisma.user.create({ data: { name: "Stranger", email: `stranger_${Date.now()}@postia.test` } }),
  ]);
  ownerId = owner.id;
  strangerId = stranger.id;
});

async function createArticle(userId: string, title: string) {
  return prisma.article.create({
    data: {
      userId,
      title,
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      contentMarkdown: "# Contenido",
      metaDescription: "Meta",
      keywords: JSON.stringify(["a"]),
    },
  });
}

describe("repositorio de artículos (aislamiento por usuario)", () => {
  it("lista solo los artículos del propietario", async () => {
    await createArticle(ownerId, "Artículo del dueño");

    const mine = await listArticlesByUser(ownerId);
    const others = await listArticlesByUser(strangerId);

    expect(mine.some((a) => a.title === "Artículo del dueño")).toBe(true);
    expect(others).toHaveLength(0);
  });

  it("getArticleForUser devuelve null si el artículo no es del usuario", async () => {
    const article = await createArticle(ownerId, "Privado");

    expect(await getArticleForUser(article.id, ownerId)).not.toBeNull();
    expect(await getArticleForUser(article.id, strangerId)).toBeNull();
  });

  it("deleteArticleForUser no borra artículos ajenos", async () => {
    const article = await createArticle(ownerId, "No me borres");

    expect(await deleteArticleForUser(article.id, strangerId)).toBe(false);
    expect(await getArticleForUser(article.id, ownerId)).not.toBeNull();

    expect(await deleteArticleForUser(article.id, ownerId)).toBe(true);
    expect(await getArticleForUser(article.id, ownerId)).toBeNull();
  });
});
