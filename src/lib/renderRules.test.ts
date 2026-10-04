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
      `u=${UID} s in ['draft', 'published', 'trashed'] v in ['private', 'public'] p in ['draft', 'published']`,
    );
  });
  it("অবৈধ uid-এ ব্যর্থ", () => {
    expect(() => renderRules("x", "")).toThrow();
    expect(() => renderRules("x", "a'b")).toThrow();
  });
  it("অচেনা placeholder থাকলে ব্যর্থ", () => {
    expect(() => renderRules("__UNKNOWN__", UID)).toThrow();
  });
});
