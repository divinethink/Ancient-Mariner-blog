import { describe, expect, it } from "vitest";
import { ACCENTS, CARD_STYLES, DEFAULT_DESIGN, FONT_PAIRS, applyDesign, resolveDesign } from "./design";

describe("resolveDesign", () => {
  it("খালি/অবৈধ ইনপুট ⇒ ডিফল্ট; আংশিক বৈধ মান রাখে", () => {
    expect(resolveDesign(undefined)).toEqual(DEFAULT_DESIGN);
    expect(resolveDesign("x")).toEqual(DEFAULT_DESIGN);
    expect(resolveDesign({ accent: "teal", fontPair: "comic", cardStyle: 5 })).toEqual({ ...DEFAULT_DESIGN, accent: "teal" });
  });
  it("সব enum মান বৈধ; ডিফল্ট তালিকার ভেতরে", () => {
    expect(ACCENTS).toContain(DEFAULT_DESIGN.accent);
    expect(FONT_PAIRS).toContain(DEFAULT_DESIGN.fontPair);
    expect(CARD_STYLES).toContain(DEFAULT_DESIGN.cardStyle);
    for (const a of ACCENTS) for (const f of FONT_PAIRS) for (const c of CARD_STYLES) expect(resolveDesign({ accent: a, fontPair: f, cardStyle: c })).toEqual({ accent: a, fontPair: f, cardStyle: c });
  });
});

describe("applyDesign", () => {
  const src = 'x();\n  var DESIGN = { accent: "terracotta", font: "serif-sans", card: "outline" };\n  y();';
  it("marker-এর মান বদলায়, বাকি অক্ষত; পুনঃপ্রয়োগ নিরাপদ", () => {
    const out = applyDesign(src, { accent: "teal", fontPair: "sans", cardStyle: "flat" });
    expect(out).toBe('x();\n  var DESIGN = { accent: "teal", font: "sans", card: "flat" };\n  y();');
    expect(applyDesign(out, DEFAULT_DESIGN)).toBe(src);
  });
  it("অবৈধ মান ডিফল্টে নামে (injection নয়); marker না থাকলে throw", () => {
    const evil = { accent: '"};alert(1);//', fontPair: "sans", cardStyle: "flat" } as never;
    expect(applyDesign(src, evil)).not.toContain("alert");
    expect(() => applyDesign("var A = 1;", DEFAULT_DESIGN)).toThrow();
  });
});
