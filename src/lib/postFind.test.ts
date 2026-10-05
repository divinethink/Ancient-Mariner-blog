import { describe, expect, it } from "vitest";
import { matchesFind, serverKey, titleRange } from "./postFind";

const p = (o: Partial<{ status: string; contentType: "post" | "diary"; categoryId: string; title: string }> = {}) => ({
  status: "draft",
  contentType: "post" as const,
  title: "কক্সবাজার ডায়েরি",
  ...o,
});

describe("serverKey", () => {
  it("অগ্রাধিকার: prefix > category > type > none", () => {
    expect(serverKey({ titlePrefix: "ক", categoryId: "c", contentType: "diary" })).toBe("prefix");
    expect(serverKey({ categoryId: "c", contentType: "diary" })).toBe("category");
    expect(serverKey({ contentType: "diary" })).toBe("type");
    expect(serverKey({})).toBe("none");
    expect(serverKey({ titlePrefix: "   " })).toBe("none");
  });
});

describe("titleRange", () => {
  it("trim করে [p, p+\\uf8ff]", () => expect(titleRange(" কক্স ")).toEqual(["কক্স", "কক্স"]));
});

describe("matchesFind", () => {
  it("ট্র্যাশ সবসময় বাদ", () => expect(matchesFind(p({ status: "trashed" }), {})).toBe(false));
  it("সব শর্তের AND", () => {
    const o = { contentType: "diary" as const, categoryId: "c1", titlePrefix: "কক্স" };
    expect(matchesFind(p({ contentType: "diary", categoryId: "c1" }), o)).toBe(true);
    expect(matchesFind(p({ contentType: "post", categoryId: "c1" }), o)).toBe(false);
    expect(matchesFind(p({ contentType: "diary" }), o)).toBe(false);
    expect(matchesFind(p({ contentType: "diary", categoryId: "c1", title: "অন্য" }), o)).toBe(false);
  });
  it("শর্ত না থাকলে ট্র্যাশ ছাড়া সব", () => expect(matchesFind(p(), {})).toBe(true));
});
