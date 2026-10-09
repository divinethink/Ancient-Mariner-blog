import { describe, expect, it } from "vitest";
import { matchItems, matchRank, mergePalette, moveIndex, norm, type PaletteItem } from "./palette";

const c = (id: string, label: string, keywords?: string): PaletteItem => ({
  id,
  kind: "command",
  label,
  keywords,
});
const p = (id: string, label: string): PaletteItem => ({ id, kind: "post", label });

describe("matchRank", () => {
  it("শুরু < শব্দের-শুরু < ভেতর < মিল-নেই", () => {
    expect(matchRank("ভ্র", "ভ্রমণ ডায়েরি")).toBe(0);
    expect(matchRank("ডায়", "ভ্রমণ ডায়েরি")).toBe(1);
    expect(matchRank("য়েরি", "ভ্রমণ ডায়েরি")).toBe(2);
    expect(matchRank("গল্প", "ভ্রমণ ডায়েরি")).toBe(-1);
  });
  it("case ও বাড়তি ফাঁকা উপেক্ষা", () => {
    expect(matchRank("  QUICK ", "quick idea")).toBe(0);
    expect(norm("A   B")).toBe("a b");
  });
});

describe("matchItems", () => {
  const all = [
    c("lib", "লাইব্রেরি", "library"),
    c("set", "সেটিংস", "settings"),
    p("1", "আমার সেটিংস গল্প"),
    p("2", "সমুদ্র"),
  ];
  it("ফাঁকা query-তে মূল ক্রমে, limit মানে", () => {
    expect(matchItems("", all, 2).map((x) => x.id)).toEqual(["lib", "set"]);
  });
  it("keywords দিয়ে মেলে; rank-ক্রম", () => {
    expect(matchItems("settings", all).map((x) => x.id)).toEqual(["set"]);
    expect(matchItems("সেটিংস", all).map((x) => x.id)).toEqual(["set", "1"]);
  });
  it("মিল না থাকলে ফাঁকা; duplicate (kind,id) একবার", () => {
    expect(matchItems("zzz", all)).toEqual([]);
    expect(matchItems("সমুদ্র", [p("2", "সমুদ্র"), p("2", "সমুদ্র")])).toHaveLength(1);
  });
  it("limit ০ বা ঋণাত্মক হলে ফাঁকা", () => {
    expect(matchItems("", all, 0)).toEqual([]);
  });
});

describe("mergePalette / moveIndex", () => {
  it("কমান্ড → loaded → remote ক্রম", () => {
    expect(mergePalette([c("a", "A")], [p("1", "x")], [p("2", "y")]).map((x) => x.id)).toEqual([
      "a",
      "1",
      "2",
    ]);
  });
  it("সূচক ঘোরে; ফাঁকায় -১", () => {
    expect(moveIndex(0, -1, 3)).toBe(2);
    expect(moveIndex(2, 1, 3)).toBe(0);
    expect(moveIndex(0, 1, 0)).toBe(-1);
  });
});
