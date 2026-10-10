import { describe, expect, it } from "vitest";
import { footerLinkError, menuRowError, moveAt, removeAt, seedMenu, withType } from "./menuEdit";

describe("moveAt/removeAt", () => {
  it("সরায়; সীমার বাইরে অপরিবর্তিত; মূল অ্যারে বদলায় না", () => {
    const a = [1, 2, 3];
    expect(moveAt(a, 0, 1)).toEqual([2, 1, 3]);
    expect(moveAt(a, 2, 1)).toEqual([1, 2, 3]);
    expect(moveAt(a, 0, -1)).toEqual([1, 2, 3]);
    expect(moveAt(a, 9, 1)).toEqual([1, 2, 3]);
    expect(a).toEqual([1, 2, 3]);
    expect(removeAt(a, 1)).toEqual([1, 3]);
  });
});

describe("withType", () => {
  it("type বদলালে ref মোছে, একই হলে অক্ষত", () => {
    const it0 = { label: "x", type: "page" as const, ref: "about" };
    expect(withType(it0, "page")).toBe(it0);
    expect(withType(it0, "link")).toEqual({ label: "x", type: "link", ref: "" });
  });
});

describe("menuRowError / footerLinkError", () => {
  it("label ও ref যাচাই", () => {
    expect(menuRowError({ label: " ", type: "link", ref: "/" })).toBe("label");
    expect(menuRowError({ label: "a", type: "link", ref: "" })).toBe("ref");
    expect(menuRowError({ label: "a", type: "link", ref: "javascript:1" })).toBe("ref");
    expect(menuRowError({ label: "a", type: "link", ref: " /blog " })).toBeNull();
    expect(menuRowError({ label: "a", type: "page", ref: "about" })).toBeNull();
    expect(menuRowError({ label: "x".repeat(41), type: "page", ref: "about" })).toBe("label");
    expect(footerLinkError({ label: "a", url: "/privacy" })).toBeNull();
    expect(footerLinkError({ label: "a", url: "data:x" })).toBe("url");
    expect(footerLinkError({ label: "", url: "/x" })).toBe("label");
  });
});

describe("seedMenu", () => {
  const labels = { home: "নীড়পাতা", blog: "ব্লগ" };
  it("নীড়পাতা + ব্লগ; about শুধু published হলে", () => {
    expect(seedMenu([], labels).map((m) => m.ref)).toEqual(["/", "/blog"]);
    expect(seedMenu([{ slug: "about", title: "এই আমি", status: "draft" }], labels)).toHaveLength(2);
    expect(seedMenu([{ slug: "about", title: "এই আমি", status: "published" }], labels)[2]).toEqual({ label: "এই আমি", type: "page", ref: "about" });
  });
});
