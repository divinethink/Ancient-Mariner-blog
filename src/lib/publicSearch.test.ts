import { describe, expect, it } from "vitest";
import { blogPath } from "./publicSite";
import { buildPublicSearchIndex, parsePublicSearchIndex, prepareSearch, searchPublic, searchResultPath } from "./publicSearch";

const post = (title: string, slug: string, excerpt: string, categoryName?: string) => ({ title, slug, excerpt, categoryName });
const idx = buildPublicSearchIndex([
  post("কক্সবাজারের ভোর", "coxs", "সাগরের ধারে ভোর", "ভ্রমণ"),
  post("বৃষ্টির দুপুর", "rain", "চায়ের কাপ আর কক্সবাজার-স্মৃতি", "ডায়েরি"),
  post("Sea Notes", "sea-notes", "waves and sand"),
]);
const run = (q: string) => searchPublic(prepareSearch(idx), q).map((e) => e.s);

describe("পাবলিক খোঁজ", () => {
  it("শিরোনামে মিললে আগে, excerpt-এ মিললে পরে", () => {
    expect(run("কক্সবাজার")).toEqual(["coxs", "rain"]);
  });
  it("শব্দ-prefix ও ক্যাটাগরি/ইংরেজি (case-insensitive)", () => {
    expect(run("কক্স")).toContain("coxs");
    expect(run("ভ্রম")).toEqual(["coxs"]);
    expect(run("SEA")).toEqual(["sea-notes"]);
  });
  it("সব শব্দ মিলতে হবে (AND); খালি/অমিল ⇒ খালি", () => {
    expect(run("কক্সবাজার চা")).toEqual(["rain"]);
    expect(run("   ")).toEqual([]);
    expect(run("নেই")).toEqual([]);
  });
  it("NFC ও অদৃশ্য ZWJ/ZWNJ অমিল ঘটায় না", () => {
    expect(run("কক্স\u200Cবাজার")).toContain("coxs");
  });
  it("excerpt ≤ ২০০; পথ blogPath-এর সমান", () => {
    const i = buildPublicSearchIndex([{ title: "a", slug: "কক্স বাজার", excerpt: "x".repeat(500) }]);
    expect(i.items[0].e.length).toBeLessThanOrEqual(200);
    expect(searchResultPath(i.items[0])).toBe(blogPath("কক্স বাজার"));
  });
  it("parse: বিকৃত/অজানা সংস্করণ ⇒ null; বিকৃত item বাদ", () => {
    expect(parsePublicSearchIndex(null)).toBeNull();
    expect(parsePublicSearchIndex({ v: 2, items: [] })).toBeNull();
    expect(parsePublicSearchIndex({ v: 1, items: [{ t: "a", s: "a" }, { t: 1 }, null] })?.items).toHaveLength(1);
  });
});
