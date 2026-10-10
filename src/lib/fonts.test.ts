import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_FONT, FONT_IDS, FONT_NAME, FONT_STACK, fontStack, isFontId } from "./fonts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("ফন্ট-তালিকা", () => {
  it("প্রতিটা id-র নাম ও stack আছে; id অনন্য; default বৈধ", () => {
    expect(new Set(FONT_IDS).size).toBe(FONT_IDS.length);
    for (const id of FONT_IDS) {
      expect(FONT_NAME[id]).toBeTruthy();
      expect(fontStack(id)).toContain("serif" === id ? "Noto Serif Bengali" : "Noto Sans Bengali"); // ইংরেজি-ফন্টেও বাংলা fallback
    }
    expect(isFontId(DEFAULT_FONT)).toBe(true);
  });
  it("isFontId: অজানা/prototype-key/অ-string বাতিল", () => {
    for (const v of ["comic", "__proto__", "", null, undefined, 3]) expect(isFontId(v)).toBe(false);
  });
});

describe("drift-guard: lib/fonts.ts ↔ globals.css ↔ public/theme-init.js", () => {
  const css = read("../app/globals.css");
  it("প্রতিটা ফন্টের [data-rfont] নিয়ম আছে ও stack হুবহু মেলে", () => {
    for (const id of FONT_IDS) {
      const m = css.match(new RegExp(`\\[data-rfont="${id}"\\] \\.reading \\{ font-family: ([^;]+); \\}`));
      expect(m, `${id}-এর CSS নিয়ম নেই`).not.toBeNull();
      expect(m![1]).toBe(FONT_STACK[id]);
    }
  });
  it("theme-init.js-এর allowlist = FONT_IDS", () => {
    const m = read("../../public/theme-init.js").match(/var RFONTS = (\[[^\]]*\]);/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1] as string)).toEqual([...FONT_IDS]);
  });
  it("প্রতিটা ফন্ট-পরিবারের @font-face বা @fontsource import আছে", () => {
    for (const f of ["noto-serif-bengali", "noto-sans-bengali", "hind-siliguri", "inter", "roboto"]) expect(css).toContain(`@fontsource/${f}/`);
    for (const f of ["SolaimanLipi", "Kalpurush"]) expect(css).toContain(`font-family: "${f}"`);
  });
});
