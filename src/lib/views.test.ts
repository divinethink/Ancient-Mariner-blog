import { describe, expect, it } from "vitest";
import { isBotUa, normalizeCountry, normalizeReferrer, parseViewPayload, postViewKey, visitorHash, visitorKey } from "./views";

const ID = "AbCdEfGhIjKlMnOpQrSt";

describe("normalizeReferrer", () => {
  it("URL → hostname, www বাদ, lowercase", () => expect(normalizeReferrer("https://WWW.Facebook.com/x?y=1")).toBe("facebook.com"));
  it("নিজের host বা খালি = direct", () => {
    expect(normalizeReferrer("https://blog.a.workers.dev/blog/x", "blog.a.workers.dev")).toBe("direct");
    expect(normalizeReferrer("")).toBe("direct");
    expect(normalizeReferrer(undefined)).toBe("direct");
  });
  it("অবৈধ/ঝুঁকিপূর্ণ মান = direct", () => {
    expect(normalizeReferrer("javascript:alert(1)")).toBe("direct");
    expect(normalizeReferrer("a b<script>")).toBe("direct");
    expect(normalizeReferrer("x".repeat(200) + ".com")).toBe("direct");
  });
  it("hostname সরাসরি দিলেও চলে", () => expect(normalizeReferrer("t.co")).toBe("t.co"));
});

describe("parseViewPayload", () => {
  it("বৈধ", () => expect(parseViewPayload({ postId: ID, referrer: "google.com" })).toEqual({ postId: ID, referrer: "google.com" }));
  it("অবৈধ postId/ধরন → null", () => {
    expect(parseViewPayload({ postId: "../x" })).toBeNull();
    expect(parseViewPayload({ postId: 5 })).toBeNull();
    expect(parseViewPayload(null)).toBeNull();
    expect(parseViewPayload("x")).toBeNull();
  });
});

describe("isBotUa / normalizeCountry", () => {
  it("bot ধরে", () => {
    expect(isBotUa("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUa("curl/8.0")).toBe(true);
    expect(isBotUa("")).toBe(true);
    expect(isBotUa(null)).toBe(true);
  });
  it("সাধারণ ব্রাউজার ধরে না", () => expect(isBotUa("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false));
  it("দেশ", () => {
    expect(normalizeCountry("bd")).toBe("BD");
    expect(normalizeCountry("T1")).toBe("XX");
    expect(normalizeCountry(null)).toBe("XX");
  });
});

describe("visitorHash", () => {
  it("নির্ধারিত, ৩২ হেক্স; ইনপুট বদলালে বদলায়", async () => {
    const a = await visitorHash("salt", "1.1.1.1", "UA", "2026-10-10");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await visitorHash("salt", "1.1.1.1", "UA", "2026-10-10")).toBe(a);
    expect(await visitorHash("salt", "1.1.1.1", "UA", "2026-10-11")).not.toBe(a);
    expect(await visitorHash("other", "1.1.1.1", "UA", "2026-10-10")).not.toBe(a);
  });
  it("key ছাঁচ", () => {
    expect(visitorKey("h")).toBe("v:h");
    expect(postViewKey(ID, "h")).toBe(`p:${ID}:h`);
  });
});
