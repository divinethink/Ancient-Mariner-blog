import { afterEach, describe, expect, it, vi } from "vitest";
import { hasOwnerHint, setOwnerHint } from "./ownerHint";

function fakeStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
}
afterEach(() => vi.unstubAllGlobals());

describe("ownerHint", () => {
  it("set/clear", () => {
    fakeStorage();
    expect(hasOwnerHint()).toBe(false);
    setOwnerHint(true);
    expect(hasOwnerHint()).toBe(true);
    setOwnerHint(false);
    expect(hasOwnerHint()).toBe(false);
  });
  it("storage ব্যর্থ হলে throw করে না", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } });
    expect(() => setOwnerHint(true)).not.toThrow();
    expect(hasOwnerHint()).toBe(false);
  });
});
