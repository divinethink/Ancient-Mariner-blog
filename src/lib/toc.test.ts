import { describe, expect, it } from "vitest";
import type { DocNode } from "./editorDoc";
import { buildToc } from "./toc";

const t = (text: string): DocNode => ({ type: "text", text });
const hd = (level: number, text: string): DocNode => ({ type: "heading", attrs: { level }, content: text ? [t(text)] : [] });
const doc = (...c: DocNode[]): DocNode => ({ type: "doc", content: c });

describe("buildToc", () => {
  it("৩+ heading হলে ক্রমানুসারে id সহ; H3 level ৩", () => {
    expect(buildToc(doc(hd(2, "এক"), { type: "paragraph", content: [t("x")] }, hd(3, "দুই"), hd(2, "তিন")))).toEqual([
      { id: "h-1", text: "এক", level: 2 },
      { id: "h-2", text: "দুই", level: 3 },
      { id: "h-3", text: "তিন", level: 2 },
    ]);
  });
  it("৩-এর কম হলে খালি", () => expect(buildToc(doc(hd(2, "এক"), hd(2, "দুই")))).toEqual([]));
  it("খালি heading বাদ কিন্তু id-ক্রম গোনে; blockquote-ভেতরের heading-ও DFS-ক্রমে", () => {
    const r = buildToc(doc(hd(2, ""), { type: "blockquote", content: [hd(2, "ভেতর")] }, hd(2, "ক"), hd(2, "খ")));
    expect(r.map((x) => x.id)).toEqual(["h-2", "h-3", "h-4"]);
  });
  it("min কাস্টমাইজ", () => expect(buildToc(doc(hd(2, "এক")), 1)).toHaveLength(1));
});
