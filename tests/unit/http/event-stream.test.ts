import { describe, expect, it } from "vitest";

import { streamJsonEvents } from "@/lib/http/event-stream";

async function readAll(response: Response): Promise<unknown[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("streamJsonEvents", () => {
  it("emite cada evento como una línea NDJSON y cierra el stream", async () => {
    const response = streamJsonEvents(async (emit) => {
      emit({ a: 1 });
      emit({ a: 2 });
    });
    expect(response.headers.get("Content-Type")).toContain("ndjson");
    expect(await readAll(response)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("emite un evento de error final si el productor lanza", async () => {
    const response = streamJsonEvents(async (emit) => {
      emit({ ok: true });
      throw new Error("falló la generación");
    });
    const events = await readAll(response);
    expect(events).toEqual([{ ok: true }, { type: "error", message: "falló la generación" }]);
  });
});
