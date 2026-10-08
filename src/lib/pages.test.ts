import { describe, expect, it } from "vitest";
import { checkPageSlug, isSystemSlug, pagePath, RESERVED_SLUGS, SYSTEM_PAGES } from "./pages";
import { parseBody } from "./editorDoc";

describe("checkPageSlug", () => {
  it("সাধারণ ও বাংলা slug ঠিক", () => {
    expect(checkPageSlug("contact")).toBe("ok");
    expect(checkPageSlug("যোগাযোগ")).toBe("ok");
  });
  it("খালি / অবৈধ (বড় হাতের, স্পেস, '.') / reserved", () => {
    expect(checkPageSlug("")).toBe("empty");
    expect(checkPageSlug("My Page")).toBe("invalid");
    expect(checkPageSlug("rss.xml")).toBe("invalid");
    expect(checkPageSlug("blog")).toBe("reserved");
    expect(checkPageSlug("dashboard")).toBe("reserved");
  });
  it("কোনো reserved slug-ই 'ok' নয় (valid-আকারেরগুলো 'reserved', বাকি 'invalid')", () => {
    for (const s of RESERVED_SLUGS) expect(checkPageSlug(s)).not.toBe("ok");
    expect(checkPageSlug("api")).toBe("reserved");
  });
  it("system slug (about/privacy) reserved নয়", () => {
    for (const p of SYSTEM_PAGES) expect(checkPageSlug(p.slug)).toBe("ok");
  });
});

describe("system pages", () => {
  it("isSystemSlug", () => {
    expect(isSystemSlug("about")).toBe(true);
    expect(isSystemSlug("contact")).toBe(false);
  });
  it("seed body বৈধ Tiptap doc", () => {
    for (const p of SYSTEM_PAGES) expect(parseBody(p.body).type).toBe("doc");
  });
});

it("pagePath percent-encoded", () => {
  expect(pagePath("about")).toBe("/about");
  expect(pagePath("যোগাযোগ")).toBe(`/${encodeURIComponent("যোগাযোগ")}`);
});
