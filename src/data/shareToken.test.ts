import { describe, expect, it } from "vitest";
import { SHARE_TOKEN_RE } from "@/lib/shareLink";
import { generateShareToken, hashShareToken } from "./shareToken";

describe("shareToken", () => {
  it("token ফরম্যাট ও অনন্যতা", () => {
    const a = generateShareToken();
    expect(SHARE_TOKEN_RE.test(a)).toBe(true);
    expect(generateShareToken()).not.toBe(a);
  });
  it("hash = SHA-256 hex (পরিচিত মান) ও নির্ণায়ক", async () => {
    expect(await hashShareToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hashShareToken("x")).toBe(await hashShareToken("x"));
  });
});
