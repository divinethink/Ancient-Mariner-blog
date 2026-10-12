import { describe, expect, it } from "vitest";
import { buildDocx } from "./exportDocx";
import type { BundleMeta, ExportPost } from "./exportBundle";

const meta: BundleMeta = {
  heading: "লেখা-সংগ্রহ",
  exportedAt: new Date(Date.UTC(2026, 9, 11)),
  timeZone: "Asia/Dhaka",
  mode: "published",
};
const t = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({
  type: "text",
  text,
  marks,
});
const body = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        t("ক্ষ ত্র জ্ঞ", [{ type: "bold" }]),
        t("খারাপ", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      ],
    },
    {
      type: "orderedList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("এক")] }] }],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [t("<b>x</b>")] }] },
    { type: "horizontalRule" },
  ],
});
const post = (o: Partial<ExportPost>): ExportPost => ({
  id: "1",
  title: "শিরোনাম",
  body,
  category: "গল্প",
  whenMs: 0,
  ...o,
});

describe("buildDocx (P13c)", () => {
  it("বৈধ .docx (zip, 'PK') বানায়", async () => {
    const buf = await buildDocx(
      [post({}), post({ id: "2", category: "অন্যান্য", whenMs: null, title: "" })],
      meta,
    );
    const head = new Uint8Array(buf, 0, 2);
    expect(String.fromCharCode(head[0], head[1])).toBe("PK");
    expect(buf.byteLength).toBeGreaterThan(2000);
  });
  it("বিকৃত body ও খালি তালিকায় throw করে না", async () => {
    await expect(buildDocx([post({ body: "not json" })], meta)).resolves.toBeInstanceOf(
      ArrayBuffer,
    );
    await expect(buildDocx([], meta)).resolves.toBeInstanceOf(ArrayBuffer);
  });
  it("ছবি-সহ লেখায় throw করে না (embed নয়, টেক্সট-স্থানধারক)", async () => {
    const withImg = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [t("আগে")] },
        { type: "mediaImage", attrs: { mediaId: "m1", alt: "সৈকত", caption: "ঢেউ" } },
        { type: "blockquote", content: [{ type: "mediaImage", attrs: { mediaId: "m2", alt: "" } }] },
      ],
    });
    const buf = await buildDocx([post({ body: withImg })], meta);
    expect(String.fromCharCode(...new Uint8Array(buf, 0, 2))).toBe("PK");
  });
});
