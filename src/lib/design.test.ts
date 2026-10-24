import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ACCENTS, CARD_STYLES, DEFAULT_DESIGN, FONT_PAIRS, PALETTES, PALETTE_BG, PALETTE_MODES, applyDesign, designMediaIds, resolveDesign } from "./design";

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
    expect(PALETTES).toContain(DEFAULT_DESIGN.palette);
    expect(DEFAULT_DESIGN.palette).toBe("classic");
    for (const p of PALETTES) for (const a of ACCENTS) for (const f of FONT_PAIRS) for (const c of CARD_STYLES) expect(resolveDesign({ palette: p, accent: a, fontPair: f, cardStyle: c })).toEqual({ palette: p, accent: a, fontPair: f, cardStyle: c });
    expect(resolveDesign({ palette: "neon" }).palette).toBe("classic");
  });
});

describe("applyDesign", () => {
  const src = 'x();\n  var DESIGN = { palette: "classic", accent: "terracotta", font: "serif-sans", card: "outline" };\n  y();';
  it("marker-এর মান বদলায়, বাকি অক্ষত; পুনঃপ্রয়োগ নিরাপদ", () => {
    const out = applyDesign(src, { palette: "slate", accent: "teal", fontPair: "sans", cardStyle: "flat" });
    expect(out).toBe('x();\n  var DESIGN = { palette: "slate", accent: "teal", font: "sans", card: "flat" };\n  y();');
    expect(applyDesign(out, DEFAULT_DESIGN)).toBe(src);
  });
  it("অবৈধ মান ডিফল্টে নামে (injection নয়); marker না থাকলে throw", () => {
    const evil = { palette: '"};alert(1);//', accent: '"};alert(1);//', fontPair: "sans", cardStyle: "flat" } as never;
    expect(applyDesign(src, evil)).not.toContain("alert");
    expect(() => applyDesign("var A = 1;", DEFAULT_DESIGN)).toThrow();
  });
});

describe("designMediaIds", () => {
  it("খালি বাদ, ডুপ্লিকেট ছাড়া", () => {
    expect(designMediaIds({})).toEqual([]);
    expect(designMediaIds({ logoMediaId: "", bannerMediaId: "b" })).toEqual(["b"]);
    expect(designMediaIds({ logoMediaId: "a", bannerMediaId: "a" })).toEqual(["a"]);
  });
});

describe("প্যালেট bg-মিল (tokens.css ↔ PALETTE_BG ↔ theme-init.js)", () => {
  const css = readFileSync("src/theme/tokens.css", "utf8");
  const init = readFileSync("public/theme-init.js", "utf8");
  for (const [name, bg] of Object.entries(PALETTE_BG)) {
    for (const t of PALETTE_MODES) {
      it(`${name}/${t}`, () => {
        const rule = css.split("\n").find((l) => l.startsWith(`[data-palette="${name}"][data-theme="${t}"]`));
        expect(rule).toBeDefined();
        expect(rule).toContain(`--bg: ${bg[t]};`);
        expect(init).toContain(`${name}: { ` + PALETTE_MODES.map((m) => `${m}: "${bg[m]}"`).join(", ") + " }");
      });
    }
  }
  it("theme-init.js-এর ডিফল্ট palette = classic", () => {
    expect(init).toContain('var DESIGN = { palette: "classic",');
  });
});
