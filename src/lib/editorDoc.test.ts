import { describe, expect, it } from "vitest";
import {
  collectMediaIds,
  countWords,
  docToText,
  EMPTY_DOC,
  makeExcerpt,
  parseBody,
  sanitizeDoc,
  serializeDoc,
} from "./editorDoc";

const p = (text: string, marks?: object[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
const doc = (...content: object[]) => ({ type: "doc", content });

describe("sanitizeDoc — allowed vs blocked", () => {
  it("অনুমোদিত node ও mark টিকে থাকে", () => {
    const d = doc(
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "শিরোনাম" }] },
      p("বাংলা", [{ type: "bold" }, { type: "italic" }, { type: "underline" }]),
      { type: "bulletList", content: [{ type: "listItem", content: [p("এক")] }] },
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p("তিন")] }] },
      { type: "blockquote", content: [p("উদ্ধৃতি")] },
      { type: "horizontalRule" },
    );
    expect(sanitizeDoc(d)).toEqual(d);
  });
  it("অননুমোদিত node বাদ (image, codeBlock, iframe…)", () => {
    const d = doc(
      { type: "image", attrs: { src: "https://x/y.png" } },
      { type: "codeBlock", content: [{ type: "text", text: "x" }] },
      { type: "iframe" },
      p("থাকবে"),
    );
    expect(sanitizeDoc(d)).toEqual(doc(p("থাকবে")));
  });
  it("অননুমোদিত mark বাদ (strike, code, highlight)", () => {
    const d = doc(p("ক", [{ type: "strike" }, { type: "code" }, { type: "bold" }]));
    expect(sanitizeDoc(d)).toEqual(doc(p("ক", [{ type: "bold" }])));
  });
  it("লিংক: http/https/mailto থাকে; javascript:/data: বাদ কিন্তু টেক্সট থাকে", () => {
    const ok = (href: string) => doc(p("ল", [{ type: "link", attrs: { href } }]));
    expect(sanitizeDoc(ok("https://a.com/x"))).toEqual(ok("https://a.com/x"));
    expect(sanitizeDoc(ok("mailto:a@b.c"))).toEqual(ok("mailto:a@b.c"));
    expect(sanitizeDoc(ok("javascript:alert(1)"))).toEqual(doc(p("ল")));
    expect(sanitizeDoc(ok("data:text/html,x"))).toEqual(doc(p("ল")));
    expect(sanitizeDoc(ok("//evil.com"))).toEqual(doc(p("ল")));
  });
  it("heading level H1/অবৈধ → H2; বাড়তি attrs ঝরে যায়", () => {
    const h = (attrs: object) => doc({ type: "heading", attrs, content: [{ type: "text", text: "ক" }] });
    expect(sanitizeDoc(h({ level: 1 })).content?.[0].attrs).toEqual({ level: 2 });
    expect(sanitizeDoc(h({ level: 3, onclick: "x" })).content?.[0].attrs).toEqual({ level: 3 });
  });
  it("অবৈধ/খালি ইনপুট → EMPTY_DOC", () => {
    expect(sanitizeDoc(null)).toEqual(EMPTY_DOC);
    expect(sanitizeDoc({ type: "paragraph" })).toEqual(EMPTY_DOC);
    expect(sanitizeDoc(doc({ type: "image" }))).toEqual(EMPTY_DOC);
  });
});

describe("parseBody / serializeDoc", () => {
  it("বিকৃত JSON-এ EMPTY_DOC", () => {
    expect(parseBody("{oops")).toEqual(EMPTY_DOC);
    expect(parseBody("")).toEqual(EMPTY_DOC);
  });
  it("round-trip", () => {
    const d = doc(p("আমার লেখা"));
    expect(parseBody(serializeDoc(d))).toEqual(d);
  });
});

describe("docToText / countWords / makeExcerpt", () => {
  it("অনুচ্ছেদ আলাদা লাইনে", () => {
    expect(docToText(sanitizeDoc(doc(p("এক দুই"), p("তিন"))))).toBe("এক দুই\nতিন");
  });
  it("hardBreak লাইন-ভাঙা", () => {
    const d = doc({
      type: "paragraph",
      content: [{ type: "text", text: "ক" }, { type: "hardBreak" }, { type: "text", text: "খ" }],
    });
    expect(docToText(sanitizeDoc(d))).toBe("ক\nখ");
  });
  it("শব্দ গণনা: বাংলা, ফাঁকা, বহু-ফাঁকা", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  ")).toBe(0);
    expect(countWords("আমি  ভোরে\nসৈকতে গেলাম")).toBe(4);
  });
  it("excerpt: ছোট হলে অপরিবর্তিত, বড় হলে কেটে '…'", () => {
    expect(makeExcerpt("ছোট\nলেখা")).toBe("ছোট লেখা");
    const e = makeExcerpt("ক".repeat(300), 160);
    expect(Array.from(e).length).toBe(161);
    expect(e.endsWith("…")).toBe(true);
  });
});

describe("mediaImage", () => {
  const img = (attrs: object) => ({ type: "mediaImage", attrs });
  it("বৈধ mediaId টিকে থাকে; raw src/url/অতিরিক্ত attr ঝরে যায়", () => {
    const d = doc(img({ mediaId: "abC_12-x", alt: " ছবি ", caption: "ক্যাপশন", src: "https://evil/x.png", url: "javascript:1" }), p("ঠিক"));
    expect(sanitizeDoc(d)).toEqual(doc(img({ mediaId: "abC_12-x", alt: "ছবি", caption: "ক্যাপশন" }), p("ঠিক")));
  });
  it("খালি caption বাদ, alt ডিফল্ট ''", () => {
    expect(sanitizeDoc(doc(img({ mediaId: "m1" }), p("ক")))).toEqual(doc(img({ mediaId: "m1", alt: "" }), p("ক")));
  });
  it("অবৈধ/অনুপস্থিত mediaId ⇒ node বাদ (URL, path, দীর্ঘ, সংখ্যা)", () => {
    for (const mediaId of ["https://x/y.png", "a/b", "a b", "", "x".repeat(65), 5, undefined, "../x"]) {
      expect(sanitizeDoc(doc(img({ mediaId }), p("ক")))).toEqual(doc(p("ক")));
    }
    expect(sanitizeDoc(doc({ type: "mediaImage" }, p("ক")))).toEqual(doc(p("ক")));
  });
  it("alt/caption ৩০০ অক্ষরে ছাঁটা; content ঝরে যায়", () => {
    const long = "ক".repeat(400);
    const out = sanitizeDoc(doc({ type: "mediaImage", attrs: { mediaId: "m", alt: long, caption: long }, content: [{ type: "text", text: "x" }] }));
    const a = (out.content?.[0].attrs ?? {}) as { alt: string; caption: string };
    expect(Array.from(a.alt)).toHaveLength(300);
    expect(Array.from(a.caption)).toHaveLength(300);
    expect(out.content?.[0].content).toBeUndefined();
  });
  it("round-trip স্থিতিশীল; পুরনো image node এখনও বাদ", () => {
    const d = doc(img({ mediaId: "m1", alt: "", caption: "ক" }));
    expect(parseBody(serializeDoc(d))).toEqual(d);
    expect(sanitizeDoc(doc({ type: "image", attrs: { src: "https://x/y.png" } }, p("ক")))).toEqual(doc(p("ক")));
  });
  it("docToText/শব্দ-গণনা/excerpt থেকে বাদ", () => {
    const d = sanitizeDoc(doc(p("এক দুই"), img({ mediaId: "m1", alt: "লুকানো alt", caption: "লুকানো ক্যাপশন" }), p("তিন")));
    expect(docToText(d)).toBe("এক দুই\nতিন");
    expect(countWords(docToText(d))).toBe(3);
  });
  it("collectMediaIds: ডুপ্লিকেট ছাড়া, ক্রম বজায়, নেস্টেড সহ", () => {
    const d = sanitizeDoc(doc(img({ mediaId: "b" }), img({ mediaId: "a" }), img({ mediaId: "b" }), { type: "blockquote", content: [img({ mediaId: "c" })] }));
    expect(collectMediaIds(d)).toEqual(["b", "a", "c"]);
    expect(collectMediaIds(EMPTY_DOC)).toEqual([]);
  });
});
