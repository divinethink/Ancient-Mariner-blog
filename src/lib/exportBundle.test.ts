import { describe, expect, it } from "vitest";
import type { BackupDoc, BackupSource } from "./backup";
import { buildHtml, buildMarkdown, bundleNote, exportFileName, filterByRange, groupByCategory, readAllPosts, selectPosts, UNCATEGORIZED } from "./exportBundle";

const body = (...c: object[]) => JSON.stringify({ type: "doc", content: c });
const para = (text: string, marks?: object[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });
const doc = (id: string, data: Record<string, unknown>): BackupDoc => ({ id, data });
const meta = { heading: "লেখা-সংগ্রহ", exportedAt: new Date("2026-10-11T00:00:00Z"), timeZone: "Asia/Dhaka", mode: "published" as const };

const docs: BackupDoc[] = [
  doc("a", { title: "প্রকাশিত", status: "published", visibility: "public", categoryName: "ভ্রমণ", body: body(para("হ্যালো")) }),
  doc("b", { title: "ব্যক্তিগত", status: "published", visibility: "private", categoryName: "ডায়েরি" }),
  doc("c", { title: "খসড়া", status: "draft", visibility: "private" }),
  doc("d", { title: "ট্র্যাশ", status: "trashed", visibility: "public" }),
  doc("e", { title: "গোপন-তালিকাভুক্ত", status: "published", visibility: "unlisted" }),
];

describe("selectPosts", () => {
  it("ডিফল্ট: শুধু published+public", () => {
    expect(selectPosts(docs, "published").map((p) => p.id)).toEqual(["a"]);
  });
  it("all: ট্র্যাশ সবসময় বাদ", () => {
    expect(selectPosts(docs, "all").map((p) => p.id)).toEqual(["a", "b", "c", "e"]);
  });
  it("ক্যাটাগরি না থাকলে 'অন্যান্য'; বিকৃত ফিল্ডে crash নয়", () => {
    const r = selectPosts([doc("x", { status: "draft", title: 5, body: null, publishedAt: "bad" })], "all");
    expect(r[0]).toMatchObject({ title: "", body: "", category: UNCATEGORIZED, whenMs: null });
  });
  it("Timestamp-জাতীয় মান (toDate) পড়ে; publishedAt না থাকলে createdAt", () => {
    const ts = { toDate: () => new Date("2026-01-02T00:00:00Z") };
    expect(selectPosts([doc("x", { status: "draft", createdAt: ts })], "all")[0].whenMs).toBe(Date.parse("2026-01-02T00:00:00Z"));
  });
});

describe("groupByCategory", () => {
  it("'অন্যান্য' সবশেষে; ভেতরে পুরনো→নতুন, তারিখহীন শেষে", () => {
    const g = groupByCategory([
      { id: "1", title: "ক", body: "", category: UNCATEGORIZED, whenMs: 1 },
      { id: "2", title: "খ", body: "", category: "ভ্রমণ", whenMs: 20 },
      { id: "3", title: "গ", body: "", category: "ভ্রমণ", whenMs: 10 },
      { id: "4", title: "ঘ", body: "", category: "ভ্রমণ", whenMs: null },
    ]);
    expect(g.map((x) => x.category)).toEqual(["ভ্রমণ", UNCATEGORIZED]);
    expect(g[0].posts.map((p) => p.id)).toEqual(["3", "2", "4"]);
  });
});

describe("buildMarkdown", () => {
  it("ক্যাটাগরি ##, লেখা ###, লেখার ভেতরের শিরোনাম ####-এ নামে", () => {
    const p = selectPosts(
      [doc("a", { title: "T", status: "published", visibility: "public", categoryName: "C", body: body({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H" }] }, para("x")) })],
      "published",
    );
    const md = buildMarkdown(p, meta);
    expect(md).toMatch(/^# লেখা-সংগ্রহ/);
    expect(md).toContain("## C\n\n### T\n");
    expect(md).toContain("#### H");
  });
  it("শিরোনামের বিশেষ চিহ্ন escape হয়", () => {
    const md = buildMarkdown([{ id: "1", title: "a*b_c", body: "", category: "ক", whenMs: null }], meta);
    expect(md).toContain("### a\\*b\\_c");
  });
  it("সাধারণ serializeDoc-এর আচরণ বদলায়নি (shift রিসেট)", async () => {
    const { serializeDoc } = await import("./export/serialize");
    const d = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H" }] }] };
    buildMarkdown([{ id: "1", title: "t", body: JSON.stringify(d), category: "c", whenMs: null }], meta);
    expect(serializeDoc(d, "md")).toBe("## H\n");
  });
});

describe("buildHtml — escape ও নিরাপত্তা", () => {
  const evil = [
    { id: "1", title: "<script>alert(1)</script>", category: "<img src=x onerror=alert(1)>", whenMs: null,
      body: body(
        para("<b>x</b>"),
        para("লিংক", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
        para("ঠিক", [{ type: "link", attrs: { href: "https://example.com/a?b=1&c=2" } }]),
        { type: "image", attrs: { src: "https://evil/x.png" } },
      ) },
  ];
  const html = buildHtml(evil, meta);
  it("শিরোনাম/ক্যাটাগরি/টেক্সট escape — কাঁচা ট্যাগ নেই", () => {
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
  it("javascript: লিংক ও allowlist-বহির্ভূত node বাদ; https লিংক থাকে", () => {
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("evil/x.png");
    expect(html).toContain('href="https://example.com/a?b=1&amp;c=2"');
  });
  it("স্ক্রিপ্ট/বাইরের রিসোর্স নেই; সূচি-লিংক আছে", () => {
    expect(html).not.toMatch(/<(script|link|img|iframe)\b/i); // escaped টেক্সট (&lt;…) বাদে আসল ট্যাগ নেই
    expect(html).toContain('href="#p0-0"');
  });
});

describe("exportFileName", () => {
  it("UTC সময়ে নাম", () => {
    expect(exportFileName(new Date("2026-10-11T03:05:00Z"), "md")).toBe("ancient-mariner-lekha-20261011-0305.md");
  });
});

describe("readAllPosts", () => {
  const mk = (n: number): BackupSource => {
    const ids = Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, "0")}`);
    return {
      count: async () => n,
      readPage: async (_c, after, size) => {
        const start = after === undefined ? 0 : ids.indexOf(after) + 1;
        return ids.slice(start, start + size).map((id) => ({ id, data: {} }));
      },
    };
  };
  it("limit-এ কাটে না — সব পাতা, প্রতিটি doc একবার", async () => {
    for (const n of [0, 1, 99, 100, 101, 250]) {
      const r = await readAllPosts(mk(n), { pageSize: 100 });
      expect(r).toHaveLength(n);
      expect(new Set(r.map((d) => d.id)).size).toBe(n);
    }
  });
  it("abort হলে throw", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(readAllPosts(mk(5), { signal: ac.signal })).rejects.toThrow();
  });
});

describe("ছবি — export-এ স্থানধারক (P6-গ২)", () => {
  const img = (attrs: object) => ({ type: "mediaImage", attrs });
  const withImg = body(para("আগে"), img({ mediaId: "m1", alt: "সৈকত", caption: "<b>ঢেউ</b> & আলো" }), img({ mediaId: "m2", alt: "" }), para("পরে"));
  const posts = [{ id: "1", title: "T", body: withImg, category: "ক", whenMs: null }];

  it("Markdown: [ছবি: ক্যাপশন] (escape-সহ), ছবি-হীন আচরণ অক্ষত", () => {
    const md = buildMarkdown(posts, meta);
    expect(md).toContain("\\[ছবি: <b>ঢেউ</b> & আলো\\]");
    expect(md).toContain("\\[ছবি\\]");
    expect(md).not.toContain("![");
    expect(md).toContain("আগে\n\n\\[ছবি:");
  });
  it("HTML: self-contained — <img>/url নেই, স্থানধারক escape করা", () => {
    const html = buildHtml(posts, meta);
    expect(html).toContain('<p class="img-ph">[ছবি: &lt;b&gt;ঢেউ&lt;/b&gt; &amp; আলো]</p>');
    expect(html).toContain('<p class="img-ph">[ছবি]</p>');
    expect(html).not.toMatch(/<img|https?:\/\/res\.cloudinary/);
  });
  it("RSS-এর bodyToHtml ডিফল্টে ছবি-স্থানধারক দেয় না", async () => {
    const { bodyToHtml } = await import("./docHtml");
    expect(bodyToHtml(withImg)).toBe("<p>আগে</p><p>পরে</p>");
  });
});

describe("filterByRange (দিনলিপি-ছ)", () => {
  const P = (id: string, iso: string | null) => ({ id, title: id, body: "", category: "x", whenMs: iso === null ? null : Date.parse(iso) });
  const posts = [P("a", "2026-01-01T00:00:00+06:00"), P("b", "2026-12-31T23:30:00+06:00"), P("c", "2025-12-31T23:30:00+06:00"), P("d", null)];
  it("সীমা না দিলে সব (তারিখহীনসহ)", () => {
    expect(filterByRange(posts, undefined, "Asia/Dhaka").map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(filterByRange(posts, {}, "Asia/Dhaka")).toHaveLength(4);
  });
  it("বছর (সাইট-timezone-এ সহ-সীমা); তারিখহীন বাদ", () => {
    expect(filterByRange(posts, { from: "2026-01-01", to: "2026-12-31" }, "Asia/Dhaka").map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("এক-পাশের সীমা", () => {
    expect(filterByRange(posts, { from: "2026-06-01" }, "Asia/Dhaka").map((p) => p.id)).toEqual(["b"]);
    expect(filterByRange(posts, { to: "2025-12-31" }, "Asia/Dhaka").map((p) => p.id)).toEqual(["c"]);
  });
  it("bundleNote-এ পরিসর শুধু দিলে আসে", () => {
    const m = { heading: "h", exportedAt: new Date(0), timeZone: "Asia/Dhaka", mode: "published" as const };
    expect(bundleNote(m, 2)).not.toContain("পরিসর");
    expect(bundleNote({ ...m, range: { from: "2026-01-01" } }, 2)).toContain("পরিসর: 2026-01-01 – আজ");
  });
});
