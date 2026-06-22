import { afterEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "@/lib/http/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("permite hasta el límite y luego bloquea dentro de la ventana", () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter.check("user")).toBe(true);
    expect(limiter.check("user")).toBe(true);
    expect(limiter.check("user")).toBe(false);
  });

  it("cuenta por clave de forma independiente", () => {
    const limiter = createRateLimiter(1, 1000);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("reinicia el contador al pasar la ventana", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter(1, 1000);
    expect(limiter.check("user")).toBe(true);
    expect(limiter.check("user")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.check("user")).toBe(true);
  });
});
