import { describe, expect, it } from "vitest";
import { DEFAULT_DIARY_LOOK, DIARY_FONTS, DIARY_SIZES, DIARY_SWATCH, DIARY_THEMES, lookFromSettings, parseDiaryLook, sameLook } from "./diaryLook";

describe("diaryLook", () => {
  it("অবৈধ/অনুপস্থিত মান ডিফল্টে ফেরে", () => {
    expect(parseDiaryLook(undefined)).toEqual(DEFAULT_DIARY_LOOK);
    expect(parseDiaryLook(null)).toEqual(DEFAULT_DIARY_LOOK);
    expect(parseDiaryLook("x")).toEqual(DEFAULT_DIARY_LOOK);
    expect(parseDiaryLook({ theme: "nope", font: 3, size: "xl" })).toEqual(DEFAULT_DIARY_LOOK);
  });
  it("প্রতিটি ফিল্ড আলাদাভাবে যাচাই", () => {
    expect(parseDiaryLook({ theme: "navy", font: "nope", size: "l" })).toEqual({ theme: "navy", font: "default", size: "l" });
  });
  it("সব বৈধ মান গ্রহণযোগ্য; প্রতিটি থিমের নমুনা-রঙ আছে", () => {
    for (const t of DIARY_THEMES) expect(parseDiaryLook({ theme: t }).theme).toBe(t);
    for (const f of DIARY_FONTS) expect(parseDiaryLook({ font: f }).font).toBe(f);
    for (const s of DIARY_SIZES) expect(parseDiaryLook({ size: s }).size).toBe(s);
    for (const t of DIARY_THEMES) expect(DIARY_SWATCH[t].bg).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("lookFromSettings: ফিল্ড না থাকলে ডিফল্ট; থাকলে সেটাই", () => {
    expect(lookFromSettings({})).toEqual(DEFAULT_DIARY_LOOK);
    expect(lookFromSettings({ diaryTheme: "plum", diaryFont: "kaiyum", diarySize: "s" })).toEqual({ theme: "plum", font: "kaiyum", size: "s" });
  });
  it("sameLook", () => {
    expect(sameLook(DEFAULT_DIARY_LOOK, { ...DEFAULT_DIARY_LOOK })).toBe(true);
    expect(sameLook(DEFAULT_DIARY_LOOK, { ...DEFAULT_DIARY_LOOK, size: "l" })).toBe(false);
  });
});
