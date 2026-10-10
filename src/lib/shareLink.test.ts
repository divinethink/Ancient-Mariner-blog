import { describe, expect, it } from "vitest";
import { SHARE_DEFAULT_DAYS, SHARE_TOKEN_RE, expiryFrom, shareState, shareUrl } from "./shareLink";

const NOW = Date.UTC(2026, 9, 10, 12, 0);
describe("shareState", () => {
  it("active / expired (সীমায়ও) / revoked সবার আগে", () => {
    expect(shareState({ expiresAt: new Date(NOW + 1) }, NOW)).toBe("active");
    expect(shareState({ expiresAt: new Date(NOW) }, NOW)).toBe("expired");
    expect(shareState({ expiresAt: new Date(NOW - 1) }, NOW)).toBe("expired");
    expect(shareState({ expiresAt: new Date(NOW + 9e9), revokedAt: new Date(NOW - 5) }, NOW)).toBe("revoked");
  });
});
describe("expiryFrom", () => {
  it("অনুমোদিত দিন; অন্য মান = ডিফল্ট", () => {
    expect(expiryFrom(NOW, 1).getTime()).toBe(NOW + 86_400_000);
    expect(expiryFrom(NOW, 30).getTime()).toBe(NOW + 30 * 86_400_000);
    expect(expiryFrom(NOW, 9999).getTime()).toBe(NOW + SHARE_DEFAULT_DAYS * 86_400_000);
    expect(expiryFrom(NOW, -3).getTime()).toBe(NOW + SHARE_DEFAULT_DAYS * 86_400_000);
  });
});
describe("token/url", () => {
  it("token regex ও url", () => {
    expect(SHARE_TOKEN_RE.test("a".repeat(43))).toBe(true);
    expect(SHARE_TOKEN_RE.test("a".repeat(42))).toBe(false);
    expect(SHARE_TOKEN_RE.test("a".repeat(42) + "/")).toBe(false);
    expect(shareUrl("https://x.dev/", "T")).toBe("https://x.dev/share/T");
  });
});
