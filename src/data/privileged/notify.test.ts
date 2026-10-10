import { describe, expect, it, vi } from "vitest";
import { sendNotice } from "./notify";

const base = { apiKey: "re_key", to: "me@example.com", subject: "বিষয়", text: "লেখা" };

describe("sendNotice", () => {
  it("সফল ⇒ true; Bearer key, to তালিকা, সীমিত আকার", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await sendNotice({ ...base, subject: "ক".repeat(500), text: "খ".repeat(5000), fetchImpl: f as unknown as typeof fetch })).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_key");
    const b = JSON.parse(String(init.body));
    expect(b.to).toEqual(["me@example.com"]);
    expect(b.subject.length).toBe(200);
    expect(b.text.length).toBe(2000);
  });
  it("৪xx/৫xx ⇒ false; network-ত্রুটি ⇒ false (কখনো throw নয়)", async () => {
    expect(await sendNotice({ ...base, fetchImpl: (async () => new Response("{}", { status: 422 })) as unknown as typeof fetch })).toBe(false);
    expect(await sendNotice({ ...base, fetchImpl: (async () => { throw new Error("net"); }) as unknown as typeof fetch })).toBe(false);
  });
  it("timeout ⇒ false", async () => {
    const slow = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(new Error("abort"))))) as unknown as typeof fetch;
    expect(await sendNotice({ ...base, fetchImpl: slow, timeoutMs: 5 })).toBe(false);
  });
});
