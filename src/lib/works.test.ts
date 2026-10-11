import { describe, expect, it } from "vitest";
import { buildWorks, chapterNeighbors, worksWordTotal, type WorkChapterIn, type WorkProjectIn } from "./works";

const d = (n: number) => new Date(2026, 9, n);
const P = (id: string, o: Partial<WorkProjectIn> = {}): WorkProjectIn => ({
  id, slug: id, title: id, description: "", type: "novel", status: "published", visibility: "public", createdAt: d(1), updatedAt: d(1), ...o,
});
const C = (id: string, projectId: string, order: number, o: Partial<WorkChapterIn> = {}): WorkChapterIn => ({
  id, projectId, slug: id, title: id, body: "", wordCount: 10, order, status: "published", visibility: "public", updatedAt: d(1), ...o,
});

describe("buildWorks", () => {
  it("শুধু published+public প্রজেক্ট ও অধ্যায়; অধ্যায় order-ক্রমে", () => {
    const w = buildWorks(
      [P("a"), P("priv", { visibility: "private" }), P("drf", { status: "draft" })],
      [C("c2", "a", 2), C("c1", "a", 1), C("cd", "a", 0, { status: "draft" }), C("cp", "a", 0, { visibility: "private" }), C("ct", "a", 0, { status: "trashed" }), C("x", "priv", 0)],
    );
    expect(w.map((x) => x.project.id)).toEqual(["a"]);
    expect(w[0].chapters.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
  it("প্রজেক্ট নতুন-হালনাগাদ আগে; অধ্যায়হীন প্রজেক্ট থাকে", () => {
    const w = buildWorks([P("old", { updatedAt: d(1) }), P("new", { updatedAt: d(5) })], []);
    expect(w.map((x) => x.project.id)).toEqual(["new", "old"]);
    expect(w[0].chapters).toEqual([]);
  });
  it("অন্য প্রজেক্টের অধ্যায় মেশে না; একই slug-এর সংঘাতে প্রথমটা", () => {
    const w = buildWorks([P("a", { slug: "s" }), P("b", { slug: "s", updatedAt: d(0) })], [C("c1", "a", 0, { slug: "x" }), C("c2", "a", 1, { slug: "x" }), C("c3", "b", 0)]);
    expect(w).toHaveLength(1);
    expect(w[0].chapters.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("chapterNeighbors / worksWordTotal", () => {
  const cs = [C("1", "a", 0), C("2", "a", 1), C("3", "a", 2)];
  it("আগের/পরের", () => {
    expect(chapterNeighbors(cs, "1")).toMatchObject({ index: 0, total: 3, prev: undefined });
    expect(chapterNeighbors(cs, "2")?.prev?.id).toBe("1");
    expect(chapterNeighbors(cs, "2")?.next?.id).toBe("3");
    expect(chapterNeighbors(cs, "3")?.next).toBeUndefined();
    expect(chapterNeighbors(cs, "nope")).toBeNull();
  });
  it("শব্দ-যোগ", () => expect(worksWordTotal(cs)).toBe(30));
});

import { chapterFeedItems, isLive, mergeFeed, projectAffectsSite, chapterAffectsSite, visibleOrderChanged } from "./works";
import { renderRss } from "./rss";
import { bookPath } from "./projects";

const PV = { status: "published", visibility: "public" };
const PR = { status: "published", visibility: "private" };
const proj = (o = {}) => ({ ...PV, title: "প", description: "ব", type: "novel", ...o });
const chap = (o = {}) => ({ ...PV, title: "অ", body: "{}", slug: "s", order: 0, ...o });

describe("projectAffectsSite (rebuild-সিদ্ধান্ত)", () => {
  it("private↔private/draft বদলে false", () => {
    expect(projectAffectsSite(proj(PR), proj({ ...PR, title: "নতুন" }))).toBe(false);
    expect(projectAffectsSite(proj({ status: "draft" }), proj({ status: "archived" }))).toBe(false);
  });
  it("দৃশ্যমানতা বদলালে true (দুই দিকেই); মোছায় true; দৃশ্যমান প্রজেক্টে নাম/বিবরণ/ধরন বদলে true, অন্য বদলে false", () => {
    expect(projectAffectsSite(proj(PR), proj())).toBe(true);
    expect(projectAffectsSite(proj(), proj(PR))).toBe(true);
    expect(projectAffectsSite(proj(), null)).toBe(true);
    expect(projectAffectsSite(proj(PR), null)).toBe(false);
    expect(projectAffectsSite(proj(), proj({ title: "ন" }))).toBe(true);
    expect(projectAffectsSite(proj(), proj({ description: "ন" }))).toBe(true);
    expect(projectAffectsSite(proj(), proj({ type: "story" }))).toBe(true);
    expect(projectAffectsSite(proj(), proj())).toBe(false);
  });
});

describe("chapterAffectsSite", () => {
  it("প্রজেক্ট দৃশ্যমান না হলে সবসময় false", () => {
    expect(chapterAffectsSite(proj(PR), chap({ status: "draft" }), chap())).toBe(false);
    expect(chapterAffectsSite(null, null, chap())).toBe(false);
  });
  it("draft→published, published→draft/private/trashed true; draft↔draft false; নতুন প্রকাশিত true", () => {
    expect(chapterAffectsSite(proj(), chap({ status: "draft" }), chap())).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap({ status: "draft" }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap({ visibility: "private" }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap({ status: "trashed" }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap({ status: "draft" }), chap({ status: "draft", title: "ন" }))).toBe(false);
    expect(chapterAffectsSite(proj(), null, chap())).toBe(true);
    expect(chapterAffectsSite(proj(), null, chap({ status: "draft" }))).toBe(false);
  });
  it("প্রকাশিত অধ্যায়ের লেখা/শিরোনাম/slug/order বদলে true; একই থাকলে false", () => {
    expect(chapterAffectsSite(proj(), chap(), chap({ body: "{x}" }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap({ title: "ন" }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap({ order: 2 }))).toBe(true);
    expect(chapterAffectsSite(proj(), chap(), chap())).toBe(false);
  });
});

describe("visibleOrderChanged", () => {
  const c = (id: string, order: number, o = {}) => ({ id, order, ...PV, ...o });
  it("দৃশ্যমান অধ্যায়ের আপেক্ষিক ক্রম বদলালে true", () => {
    expect(visibleOrderChanged(proj(), [c("a", 0), c("b", 1)], [c("a", 1), c("b", 0)])).toBe(true);
  });
  it("private অধ্যায়ের সাথে অদলবদলে দৃশ্যমান ক্রম একই ⇒ false; প্রজেক্ট private ⇒ false", () => {
    const priv = { status: "draft" };
    expect(visibleOrderChanged(proj(), [c("a", 0), c("p", 1, priv), c("b", 2)], [c("p", 0, priv), c("a", 1), c("b", 2)])).toBe(false);
    expect(visibleOrderChanged(proj(PR), [c("a", 0), c("b", 1)], [c("a", 1), c("b", 0)])).toBe(false);
  });
  it("isLive", () => expect(isLive(PV) && !isLive(PR)).toBe(true));
});

describe("RSS-এ অধ্যায়", () => {
  const t = (d: number) => new Date(Date.UTC(2026, 9, d));
  const works = buildWorks(
    [{ ...P("p", { slug: "প্রাচীন", title: "প্রাচীন নাবিক" }) }],
    [C("c1", "p", 0, { slug: "এক", title: "প্রথম", publishedAt: t(5), updatedAt: t(5), body: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "শুরু" }] }] }) })],
  );
  it("feed-আইটেমের লিংক /works/…, শিরোনাম 'প্রজেক্ট — অধ্যায়'; পোস্টের সাথে তারিখ-ক্রমে মেশে", () => {
    const items = chapterFeedItems(works);
    expect(items[0].title).toBe("প্রাচীন নাবিক — প্রথম");
    const post = { slug: "post", title: "পোস্ট", excerpt: "সা", body: "{}", publishedAt: t(9), updatedAt: t(9) };
    const old = { slug: "old", title: "পুরনো", excerpt: "সা", body: "{}", publishedAt: t(1), updatedAt: t(1) };
    expect(mergeFeed([post, old], items).map((x) => x.slug)).toEqual(["post", "এক", "old"]);
    const xml = renderRss({ siteUrl: "https://ex.dev", title: "T", description: "D", posts: mergeFeed([post], items), items: 10, mode: "excerpt" });
    expect(xml).toContain("https://ex.dev/works/%E0%A6%AA"); // percent-encoded /works/প্রাচীন/…
    expect(xml).toContain("https://ex.dev/blog/post");
    expect(xml).toContain("<description>শুরু</description>");
  });
  it("bookPath", () => expect(bookPath("প্রাচীন নাবিক")).toBe("/book/" + encodeURIComponent("প্রাচীন নাবিক")));
});
