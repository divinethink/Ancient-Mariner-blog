import { describe, expect, it } from "vitest";
import { createGoalStore } from "./goalStore";

function memoryKV() {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k: string, v: unknown) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
    keys: async () => [...m.keys()],
  };
}

describe("goalStore", () => {
  it("record → wordsToday; পরের দিনে আগের দিনের key মোছে", async () => {
    const kv = memoryKV();
    const s = createGoalStore(kv);
    await s.record("2026-10-09", "a", 120, 100);
    await s.record("2026-10-09", "a", 140, 100);
    expect(await s.wordsToday("2026-10-09")).toBe(40);
    await s.record("2026-10-10", "a", 140, 140);
    expect(await s.wordsToday("2026-10-10")).toBe(0);
    expect(await kv.keys()).toEqual(["goal:2026-10-10"]);
  });
  it("key না থাকলে ০", async () => {
    expect(await createGoalStore(memoryKV()).wordsToday("2026-10-09")).toBe(0);
  });
});
