import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderRules } from "./renderRules";

const UID = "abcDEF1234567890xyz";
describe("renderRules", () => {
  it("uid ও enum-তালিকা বসায়", () => {
    const out = renderRules(
      "u=__OWNER_UID__ s in __POST_STATUS__ v in __POST_VISIBILITY__ p in __PAGE_STATUS__",
      UID,
    );
    expect(out).toBe(
      `u=${UID} s in ['draft', 'published', 'trashed', 'archived', 'scheduled'] v in ['private', 'public', 'unlisted'] p in ['draft', 'published']`,
    );
  });
  it("media enum-তালিকা বসায়", () => {
    expect(renderRules("__MEDIA_TYPE__ __MEDIA_DELIVERY__ __MEDIA_VISIBILITY__", UID)).toBe(
      "['image', 'file'] ['upload', 'authenticated'] ['public', 'private']",
    );
  });
  it("writing project/chapter enum-তালিকা বসায়", () => {
    expect(renderRules("__PROJECT_STATUS__ __PROJECT_VISIBILITY__ __CHAPTER_STATUS__ __CHAPTER_VISIBILITY__", UID)).toBe(
      "['draft', 'published', 'archived'] ['private', 'public'] ['draft', 'published', 'trashed'] ['private', 'public']",
    );
  });
  it("book enum-তালিকা বসায়", () => {
    expect(renderRules("__BOOK_STATUS__ __BOOK_VISIBILITY__", UID)).toBe("['wishlist', 'reading', 'finished'] ['private', 'public']");
  });
  it("অবৈধ uid-এ ব্যর্থ", () => {
    expect(() => renderRules("x", "")).toThrow();
    expect(() => renderRules("x", "a'b")).toThrow();
  });
  it("অচেনা placeholder থাকলে ব্যর্থ", () => {
    expect(() => renderRules("__UNKNOWN__", UID)).toThrow();
  });
  it("আসল firestore.rules.tpl সম্পূর্ণ render হয় ও deny-all ফলব্যাক রাখে", () => {
    const out = renderRules(readFileSync("firestore.rules.tpl", "utf8"), UID);
    expect(out).toContain(`request.auth.uid == '${UID}'`);
    expect(out).toContain("['draft', 'published', 'trashed', 'archived', 'scheduled']");
    expect(out).toContain("match /{document=**}");
  });
});
