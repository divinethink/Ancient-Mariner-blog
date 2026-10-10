import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, verifyTurnstile } from "./turnstile";

const res = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("verifyTurnstile", () => {
  it("সফল ⇒ true; secret/response/remoteip form-এ যায়", async () => {
    const f = vi.fn(async () => res({ success: true }));
    expect(await verifyTurnstile({ secret: "S", token: "T", ip: "1.2.3.4", fetchImpl: f as unknown as typeof fetch })).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect((init.body as URLSearchParams).toString()).toBe("secret=S&response=T&remoteip=1.2.3.4");
  });
  it("অবৈধ token ⇒ false, retry নয় (token এক-ব্যবহারী)", async () => {
    const f = vi.fn(async () => res({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyTurnstile({ secret: "S", token: "T", fetchImpl: f as unknown as typeof fetch })).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("৫xx-এ retry; শেষে ব্যর্থ হলে throw (route ⇒ ৫০৩, 'ভুল token' নয়)", async () => {
    const f = vi.fn(async () => res({}, 502));
    await expect(verifyTurnstile({ secret: "S", token: "T", fetchImpl: f as unknown as typeof fetch })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("remoteip না থাকলে পাঠানো হয় না", async () => {
    const f = vi.fn(async () => res({ success: true }));
    await verifyTurnstile({ secret: "S", token: "T", ip: null, fetchImpl: f as unknown as typeof fetch });
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams).has("remoteip")).toBe(false);
  });
});
