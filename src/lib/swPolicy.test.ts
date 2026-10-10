import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// public/sw-policy.js = sw.js-এর আসল নীতি; এখানে একই ফাইল যাচাই (Arch §১২)
type Policy = {
  isPrivatePath(p: string): boolean;
  classify(r: { method: string; mode: string; url: string }, origin: string): string;
  isCacheableResponse(r: unknown): boolean;
};
const P = createRequire(import.meta.url)("../../public/sw-policy.js") as Policy;
const O = "https://blog.example.workers.dev";
const get = (path: string, mode = "navigate") => P.classify({ method: "GET", mode, url: O + path }, O);

describe("private route — কখনো cache নয়", () => {
  it.each([
    "/dashboard", "/dashboard/", "/dashboard/posts/abc/edit", "/dashboard/inbox/share?title=x",
    "/login", "/login?next=/dashboard", "/api/owner/rebuild", "/api/view", "/build.json",
    "/sw.js", "/sw-policy.js", "/share/abc",
    "/Dashboard/posts", "/%64ashboard/posts", "/API/owner/backup",
  ])("%s → none (navigate ও fetch দুই মোডে)", (p) => {
    expect(get(p)).toBe("none");
    expect(get(p, "cors")).toBe("none");
    expect(get(p, "no-cors")).toBe("none");
  });
  it("সীমানা: /dashboardx-ও সতর্কতায় private ধরা হয় না — কিন্তু /blog, /category পাবলিক", () => {
    expect(P.isPrivatePath("/blog/hello")).toBe(false);
    expect(P.isPrivatePath("/category/ভ্রমণ")).toBe(false);
  });
});

describe("পাবলিক রিসোর্স", () => {
  it("পাবলিক navigation = page", () => {
    for (const p of ["/", "/blog/কক্সবাজার", "/category/a", "/about", "/offline", "/tag/%E0%A6%AD"])
      expect(get(p)).toBe("page");
  });
  it("_next/static = static; icons ও theme-init = asset", () => {
    expect(get("/_next/static/chunks/a.js", "no-cors")).toBe("static");
    expect(get("/icons/icon-192.png", "no-cors")).toBe("asset");
    expect(get("/theme-init.js", "no-cors")).toBe("asset");
  });
  it("অন্য fetch (rss, json, ছবি) ও non-GET ও cross-origin = none", () => {
    expect(get("/rss.xml", "cors")).toBe("none");
    expect(get("/data/cards-1.json", "cors")).toBe("none");
    expect(P.classify({ method: "POST", mode: "navigate", url: O + "/" }, O)).toBe("none");
    expect(P.classify({ method: "GET", mode: "no-cors", url: "https://res.cloudinary.com/x.jpg" }, O)).toBe("none");
    expect(P.classify({ method: "GET", mode: "navigate", url: "not a url" }, O)).toBe("none");
  });
});

describe("isCacheableResponse", () => {
  const res = (o: Partial<{ status: number; type: string; redirected: boolean; cc: string }> = {}) => ({
    status: o.status ?? 200,
    type: o.type ?? "basic",
    redirected: o.redirected ?? false,
    headers: { get: (k: string) => (k === "Cache-Control" ? (o.cc ?? "") : null) },
  });
  it("সাধারণ 200 basic = হ্যাঁ", () => expect(P.isCacheableResponse(res())).toBe(true));
  it("no-store/private, redirect, non-200, opaque/cors = না", () => {
    expect(P.isCacheableResponse(res({ cc: "private, no-store" }))).toBe(false);
    expect(P.isCacheableResponse(res({ cc: "no-store" }))).toBe(false);
    expect(P.isCacheableResponse(res({ redirected: true }))).toBe(false);
    expect(P.isCacheableResponse(res({ status: 404 }))).toBe(false);
    expect(P.isCacheableResponse(res({ type: "opaque" }))).toBe(false);
    expect(P.isCacheableResponse(null)).toBe(false);
  });
});

describe("P10a-২: পাবলিক খোঁজ", () => {
  it("/search-index.json fetch SW-cache হয় না (বাসি index এড়াতে সবসময় নেটওয়ার্ক)", () => {
    expect(get("/search-index.json", "cors")).toBe("none");
    expect(get("/search-index.json", "no-cors")).toBe("none");
  });
  it("/search পেজ নিজে সাধারণ পাবলিক navigation (NetworkFirst)", () => {
    expect(get("/search?q=%E0%A6%AD%E0%A7%8B%E0%A6%B0")).toBe("page");
  });
});
