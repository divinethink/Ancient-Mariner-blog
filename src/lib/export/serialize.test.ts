import { describe, expect, it } from "vitest";
import type { DocNode } from "../editorDoc";
import { serializeDoc, serializeDocShifted, serializePost } from "./serialize";

const t = (text: string, marks?: DocNode["marks"]): DocNode => ({
  type: "text",
  text,
  ...(marks ? { marks } : {}),
});
const p = (...c: DocNode[]): DocNode => ({ type: "paragraph", content: c });
const doc = (...c: DocNode[]): DocNode => ({ type: "doc", content: c });

describe("serializeDoc — Markdown", () => {
  it("heading, mark, link", () => {
    const d = doc(
      { type: "heading", attrs: { level: 2 }, content: [t("শুরু")] },
      p(
        t("কড়া", [{ type: "bold" }]),
        t(" ও "),
        t("হেলানো", [{ type: "italic" }]),
        t(" ও "),
        t("লিংক", [{ type: "link", attrs: { href: "https://a.bc/x" } }]),
      ),
    );
    expect(serializeDoc(d, "md")).toBe("## শুরু\n\n**কড়া** ও *হেলানো* ও [লিংক](https://a.bc/x)\n");
  });
  it("বিশেষ অক্ষর escape; underline = <u>", () => {
    expect(serializeDoc(doc(p(t("a*b_[c]"))), "md")).toBe("a\\*b\\_\\[c\\]\n");
    expect(serializeDoc(doc(p(t("নিচে", [{ type: "underline" }]))), "md")).toBe("<u>নিচে</u>\n");
  });
  it("তালিকা, ক্রমিক (start), quote, hr", () => {
    const li = (s: string): DocNode => ({ type: "listItem", content: [p(t(s))] });
    const d = doc(
      { type: "bulletList", content: [li("এক"), li("দুই")] },
      { type: "orderedList", attrs: { start: 3 }, content: [li("তিন"), li("চার")] },
      { type: "blockquote", content: [p(t("উক্তি"))] },
      { type: "horizontalRule" },
    );
    expect(serializeDoc(d, "md")).toBe("- এক\n- দুই\n\n3. তিন\n4. চার\n\n> উক্তি\n\n---\n");
  });
  it("hardBreak", () => {
    expect(serializeDoc(doc(p(t("এক"), { type: "hardBreak" }, t("দুই"))), "md")).toBe(
      "এক  \nদুই\n",
    );
  });
});

describe("serializeDoc — সাধারণ", () => {
  it("marker/escape ছাড়া; তালিকায় •; heading শুধু টেক্সট", () => {
    const d = doc(
      { type: "heading", attrs: { level: 3 }, content: [t("শিরো")] },
      p(t("a*b", [{ type: "bold" }])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(t("এক"))] }] },
    );
    expect(serializeDoc(d, "plain")).toBe("শিরো\n\na*b\n\n• এক\n");
  });
  it("খালি doc → খালি string", () => {
    expect(serializeDoc(doc(p()), "plain")).toBe("");
    expect(serializeDoc({ type: "doc" }, "md")).toBe("");
  });
});

describe("serializePost", () => {
  it("শিরোনাম থাকলে; না থাকলে শুধু বডি", () => {
    expect(serializePost("নাম", doc(p(t("লেখা"))), "md")).toBe("# নাম\n\nলেখা\n");
    expect(serializePost("নাম", doc(p(t("লেখা"))), "plain")).toBe("নাম\n\nলেখা\n");
    expect(serializePost("  ", doc(p(t("লেখা"))), "plain")).toBe("লেখা\n");
    expect(serializePost("নাম", doc(p()), "md")).toBe("# নাম\n");
  });
});

describe("ছবি (mediaImage)", () => {
  const img = (attrs: Record<string, unknown>): DocNode => ({ type: "mediaImage", attrs });
  const d = doc(p(t("আগে")), img({ mediaId: "m1", alt: "সৈকত", caption: "ভোরের ঢেউ" }), p(t("পরে")));
  const url = (id: string) => (id === "m1" ? "https://res.cloudinary.com/c/image/upload/f_auto/x (1).jpg" : undefined);

  it("ডিফল্টে (খোঁজ-index) ছবি বাদ — আগের আচরণ অক্ষত", () => {
    expect(serializeDoc(d, "plain")).toBe("আগে\n\nপরে\n");
    expect(serializeDoc(d, "md")).toBe("আগে\n\nপরে\n");
  });
  it("সাধারণ কপি: ক্যাপশন, না থাকলে alt, না থাকলে [ছবি]", () => {
    expect(serializePost("", d, "plain")).toBe("আগে\n\n[ছবি: ভোরের ঢেউ]\n\nপরে\n");
    expect(serializePost("", doc(img({ mediaId: "m1", alt: "সৈকত" })), "plain")).toBe("[ছবি: সৈকত]\n");
    expect(serializePost("", doc(img({ mediaId: "m1", alt: "" })), "plain")).toBe("[ছবি]\n");
  });
  it("Markdown + url: ![alt](url) ও ক্যাপশন; url-এর স্পেস/বন্ধনী escape", () => {
    expect(serializePost("", d, "md", { mediaUrl: url })).toBe(
      "আগে\n\n![সৈকত](https://res.cloudinary.com/c/image/upload/f_auto/x%20%281%29.jpg)\n\n*ভোরের ঢেউ*\n\nপরে\n",
    );
  });
  it("Markdown, url না মিললে/অনিরাপদ হলে স্থানধারক (escape-সহ)", () => {
    expect(serializePost("", d, "md")).toBe("আগে\n\n\\[ছবি: ভোরের ঢেউ\\]\n\nপরে\n");
    expect(serializePost("", d, "md", { mediaUrl: () => "javascript:alert(1)" })).toContain("\\[ছবি:");
    expect(serializePost("", doc(img({ mediaId: "a/b", alt: "x" })), "md", { mediaUrl: () => "https://x/y" })).toBe("\\[ছবি: x\\]\n");
  });
  it("alt-এ ] ও নতুন লাইন বিপদ করে না; অন্য serialize-এ অবস্থা লিক করে না", () => {
    const o = serializePost("", doc(img({ mediaId: "m1", alt: "a]b\nc" })), "md", { mediaUrl: url });
    expect(o.startsWith("![a\\]b c](https://")).toBe(true);
    expect(serializeDoc(d, "md")).toBe("আগে\n\nপরে\n"); // আগের কলের images/mediaUrl মনে নেই
  });
  it("সংগ্রহ-এক্সপোর্ট (serializeDocShifted): [ছবি: …] — url ছাড়া, self-contained", () => {
    expect(serializeDocShifted(d, 2)).toContain("\\[ছবি: ভোরের ঢেউ\\]");
  });
  it("blockquote/তালিকার ভেতরের ছবিও", () => {
    const q = doc({ type: "blockquote", content: [img({ mediaId: "m1", caption: "ক" })] });
    expect(serializePost("", q, "md")).toBe("> \\[ছবি: ক\\]\n");
  });
});
