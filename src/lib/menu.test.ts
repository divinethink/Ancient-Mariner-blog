import { describe, expect, it } from "vitest";
import { isInternalPath, isSafeHref, isValidMenuRef, resolveFooter, resolveMenu, type MenuItem } from "./menu";

const pagePath = (s: string) => `/${s}`;
const ctx = { pages: [{ slug: "about" }], categories: [{ id: "c1", path: "/category/golpo" }] };

describe("isSafeHref", () => {
  it("http(s) ও ভেতরের পথ চলে", () => {
    for (const u of ["https://a.com/x", "http://a.com", "/", "/blog", "/category/গল্প"]) expect(isSafeHref(u)).toBe(true);
  });
  it("বিপজ্জনক/অবৈধ নয়", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "/\\evil.com", "/a b", "/a\nb", "blog", "", "mailto:a@b.c", "/\u0000"]) {
      expect(isSafeHref(u)).toBe(false);
    }
    expect(isInternalPath("//x")).toBe(false);
  });
});

describe("isValidMenuRef", () => {
  it("type অনুযায়ী যাচাই", () => {
    expect(isValidMenuRef("page", "about")).toBe(true);
    expect(isValidMenuRef("page", "a b")).toBe(false);
    expect(isValidMenuRef("page", "")).toBe(false);
    expect(isValidMenuRef("category", "c1")).toBe(true);
    expect(isValidMenuRef("category", "c 1")).toBe(false);
    expect(isValidMenuRef("link", "/blog")).toBe(true);
    expect(isValidMenuRef("link", "javascript:x")).toBe(false);
    expect(isValidMenuRef("link", "x".repeat(301))).toBe(false);
  });
});

describe("resolveMenu", () => {
  it("খালি সংরক্ষিত ⇒ null (default মেনু)", () => {
    expect(resolveMenu([], ctx, pagePath)).toBeNull();
  });
  it("draft/মোছা পেজ ও ক্যাটাগরি লুকায়, বাকিরা ক্রম ধরে", () => {
    const m: MenuItem[] = [
      { label: "নীড়", type: "link", ref: "/" },
      { label: "আমি", type: "page", ref: "about" },
      { label: "গোপন", type: "page", ref: "draft-page" },
      { label: "গল্প", type: "category", ref: "c1" },
      { label: "নেই", type: "category", ref: "gone" },
      { label: "বাইরে", type: "link", ref: "https://x.com" },
      { label: "খারাপ", type: "link", ref: "javascript:1" },
    ];
    expect(resolveMenu(m, ctx, pagePath)).toEqual([
      { label: "নীড়", href: "/", external: false },
      { label: "আমি", href: "/about", external: false },
      { label: "গল্প", href: "/category/golpo", external: false },
      { label: "বাইরে", href: "https://x.com", external: true },
    ]);
  });
  it("সব আইটেম লুকালে খালি অ্যারে (null নয়)", () => {
    expect(resolveMenu([{ label: "x", type: "page", ref: "nope" }], ctx, pagePath)).toEqual([]);
  });
});

describe("resolveFooter", () => {
  it("ফাঁকা ⇒ default টেক্সট ও null লিংক", () => {
    expect(resolveFooter({ text: "  ", links: [] }, "© সাইট")).toEqual({ text: "© সাইট", links: null });
  });
  it("নিজের টেক্সট ও নিরাপদ লিংক", () => {
    const r = resolveFooter({ text: "আমার", links: [{ label: "a", url: "/x" }, { label: "b", url: "javascript:1" }] }, "d");
    expect(r).toEqual({ text: "আমার", links: [{ label: "a", href: "/x", external: false }] });
  });
  it("সব লিংক অবৈধ হলে null", () => {
    expect(resolveFooter({ text: "", links: [{ label: "b", url: "data:x" }] }, "d").links).toBeNull();
  });
});
