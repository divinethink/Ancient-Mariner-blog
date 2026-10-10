import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMFORT,
  THEME_BG,
  THEME_PREFS,
  comfortVars,
  parseComfort,
  resolveTheme,
  typewriterDelta,
} from "./comfort";

describe("parseComfort", () => {
  it("খালি/ভাঙা/অ-object → default", () => {
    for (const r of [undefined, null, "", "{", "[]", "5", 7])
      expect(parseComfort(r)).toEqual(DEFAULT_COMFORT);
  });
  it("বৈধ মান থাকে", () => {
    const c = { font: "sans", size: 22, line: 21, width: 860 };
    expect(parseComfort(JSON.stringify(c))).toEqual(c);
  });
  it("অবৈধ ফিল্ড শুধু সেটাই default-এ ফেরে", () => {
    expect(parseComfort({ font: "comic", size: 99, line: 20, width: 700 })).toEqual({
      font: "serif",
      size: 19,
      line: 20,
      width: 680,
    });
  });
  it("নতুন ফন্ট-id (P12-১) বৈধ; অজানা → serif", () => {
    expect(parseComfort({ font: "hind" }).font).toBe("hind");
    expect(parseComfort({ font: "roboto" }).font).toBe("roboto");
    expect(parseComfort({ font: "comic" }).font).toBe("serif");
  });
  it("দশমিক size বাতিল", () => expect(parseComfort({ size: 18.5 }).size).toBe(19));
});

describe("comfortVars", () => {
  it("variable বানায়", () => {
    expect(comfortVars({ font: "sans", size: 20, line: 24, width: 560 })).toEqual({
      "--ff": '"Noto Sans Bengali", system-ui, sans-serif',
      "--fs": "20px",
      "--lh": "2.4",
      "--mw": "560px",
    });
  });
});

describe("THEME_PREFS", () => {
  it("auto ছাড়া প্রতিটির bg আছে ও resolveTheme নিজেই ফেরে", () => {
    for (const p of THEME_PREFS.filter((x) => x !== "auto")) {
      expect(THEME_BG[p]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(resolveTheme(p, false)).toBe(p);
    }
    expect(THEME_PREFS).toEqual(["auto", "light", "sepia", "warm", "dark", "amoled"]);
  });
});

describe("typewriterDelta", () => {
  it("লক্ষ্যের নিচে থাকলে ধনাত্মক (নিচে scroll), উপরে থাকলে ঋণাত্মক", () => {
    expect(typewriterDelta(600, 1000)).toBe(200);
    expect(typewriterDelta(100, 1000)).toBe(-300);
  });
  it("সহনসীমার ভেতরে বা অবৈধ মানে ০", () => {
    expect(typewriterDelta(410, 1000)).toBe(0);
    expect(typewriterDelta(NaN, 1000)).toBe(0);
    expect(typewriterDelta(300, 0)).toBe(0);
  });
});

describe("resolveTheme", () => {
  it("auto সিস্টেম অনুসরণ", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });
  it("সরাসরি মান; অচেনা/null → light", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("sepia", true)).toBe("sepia");
    expect(resolveTheme("neon", true)).toBe("light");
    expect(resolveTheme(null, true)).toBe("light");
  });
});
