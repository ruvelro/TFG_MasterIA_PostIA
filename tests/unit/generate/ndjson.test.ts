import { describe, expect, it } from "vitest";

import { splitNdjson } from "@/app/(app)/generate/use-generation-stream";

describe("splitNdjson", () => {
  it("parsea las líneas completas y conserva la incompleta", () => {
    const { events, rest } = splitNdjson('{"a":1}\n{"b":2}\n{"c":');
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
    expect(rest).toBe('{"c":');
  });

  it("no devuelve eventos si no hay ninguna línea completa", () => {
    const { events, rest } = splitNdjson('{"parcial":');
    expect(events).toEqual([]);
    expect(rest).toBe('{"parcial":');
  });

  it("ignora líneas en blanco", () => {
    const { events } = splitNdjson('{"a":1}\n\n');
    expect(events).toEqual([{ a: 1 }]);
  });
});
