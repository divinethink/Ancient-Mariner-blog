import { describe, expect, it } from "vitest";
import { cldOgUrl, cloudFromUrl, cldSrcSet, cldUrl, isValidCloudName, isValidPublicId, snapWidth } from "./cloudinary";

describe("cloudinary URL", () => {
  it("প্রস্থ উপরের ধাপে snap হয়; সর্বোচ্চে আটকায়", () => {
    expect(snapWidth(1)).toBe(320);
    expect(snapWidth(321)).toBe(480);
    expect(snapWidth(800)).toBe(800);
    expect(snapWidth(99999)).toBe(2000);
    expect(snapWidth(Number.NaN)).toBe(320);
  });
  it("f_auto,q_auto সবসময়; প্রস্থ দিলে w_+c_limit", () => {
    expect(cldUrl("demo", "blog/abc")).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/blog/abc");
    expect(cldUrl("demo", "blog/abc", { w: 700 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/blog/abc",
    );
  });
  it("অবৈধ cloud/public_id ⇒ null (path-traversal/injection আটকায়)", () => {
    expect(cldUrl("de mo", "blog/abc")).toBeNull();
    expect(cldUrl("demo", "../x")).toBeNull();
    expect(cldUrl("demo", "blog/../x")).toBeNull();
    expect(cldUrl("demo", "/blog/abc")).toBeNull();
    expect(cldUrl("demo", "blog/abc/")).toBeNull();
    expect(cldUrl("demo", "a b")).toBeNull();
    expect(cldUrl("demo", "বাংলা")).toBeNull();
    expect(cldUrl("demo", "x,w_9999/y")).toBeNull();
    expect(isValidCloudName("")).toBe(false);
    expect(isValidPublicId("a".repeat(201))).toBe(false);
  });
  it("srcset সীমিত ধাপে; মূল প্রস্থের বেশি নয়", () => {
    const s = cldSrcSet("demo", "blog/abc", 700)!;
    expect(s.split(", ").map((x) => x.split(" ")[1])).toEqual(["320w", "480w", "640w", "800w"]);
    expect(cldSrcSet("demo", "../x")).toBeNull();
  });
  it("OG ১২০০×৬৩০ fill", () => {
    expect(cldOgUrl("demo", "blog/abc")).toContain("c_fill,g_auto,w_1200,h_630");
    expect(cldOgUrl("x", "blog/abc")).toBeNull(); // cloud name ≥২ অক্ষর
    expect(cldOgUrl("demo", "bad id")).toBeNull();
  });
  it("cloudFromUrl", () => {
    expect(cloudFromUrl("https://res.cloudinary.com/demo/image/upload/v1/blog/a.jpg")).toBe("demo");
    expect(cloudFromUrl("https://evil.test/res.cloudinary.com/demo/x")).toBeNull();
    expect(cloudFromUrl(undefined)).toBeNull();
  });
});
