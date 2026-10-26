import { describe, expect, it } from "vitest";
import { moonFraction, moonIllumination, moonKind, moonPathD } from "./moonPhase";

describe("moonPhase", () => {
  it("অবৈধ তারিখে null", () => {
    expect(moonFraction("nope")).toBeNull();
  });
  it("পূর্ণিমা (২০২৬-১০-২৬) ও অমাবস্যা (২০২৬-১০-১০) কাছাকাছি ধরে", () => {
    const full = moonFraction("2026-10-26") as number;
    const nw = moonFraction("2026-10-10") as number;
    expect(moonIllumination(full)).toBeGreaterThanOrEqual(97);
    expect(moonKind(full)).toBe("full");
    expect(moonIllumination(nw)).toBeLessThanOrEqual(5);
    expect(moonKind(nw)).toBe("new");
  });
  it("২০২৬-১০-২৩ = শুক্লপক্ষ, প্রায় পূর্ণ", () => {
    const f = moonFraction("2026-10-23") as number;
    expect(moonKind(f)).toBe("waxing");
    expect(moonIllumination(f)).toBeGreaterThan(85);
  });
  it("path সবসময় বৈধ বন্ধ-পথ; কলার দুই পাশে দুই রকম", () => {
    for (const f of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) expect(moonPathD(f)).toMatch(/^M50 6A44 44 0 0 [01] 50 94A[\d.]+ 44 0 0 [01] 50 6Z$/);
    expect(moonPathD(0.25)).not.toBe(moonPathD(0.75));
  });
});
