import { describe, expect, it } from "vitest";
import { DEFAULT_COMFORT, comfortVars, parseComfort, resolveTheme } from "./comfort";

describe("parseComfort", () => {
  it("খালি/ভাঙা/অ-object → default", () => {
    for (const r of [undefined, null, "", "{", "[]", "5", 7]) expect(parseComfort(r)).toEqual(DEFAULT_COMFORT);
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
  it("দশমিক size বাতিল", () => expect(parseComfort({ size: 18.5 }).size).toBe(19));
});

describe("comfortVars", () => {
  it("variable বানায়", () => {
    expect(comfortVars({ font: "sans", size: 20, line: 24, width: 560 })).toEqual({
      "--ff": "var(--font-sans)",
      "--fs": "20px",
      "--lh": "2.4",
      "--mw": "560px",
    });
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
