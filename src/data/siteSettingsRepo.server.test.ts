import { describe, expect, it, vi } from "vitest";
import { createPublicSettingsSource } from "./siteSettingsRepo.server";
import { DEFAULT_SETTINGS } from "./siteSettingsRepo";

const mk = (res: Partial<Response> & { json?: () => Promise<unknown> }) =>
  vi.fn<typeof fetch>(async () => res as Response);
const opts = (fetchImpl: typeof fetch) => ({ projectId: "p", apiKey: "K", fetchImpl });

describe("createPublicSettingsSource", () => {
  it("404 (doc নেই) → defaults, একবারই ডাকে", async () => {
    const f = mk({ status: 404, ok: false });
    expect(await createPublicSettingsSource(opts(f)).read()).toEqual(DEFAULT_SETTINGS);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("doc থাকলে REST fields decode + defensive parse", async () => {
    const f = mk({
      status: 200,
      ok: true,
      json: async () => ({
        name: "projects/p/databases/(default)/documents/siteSettings/main",
        fields: {
          siteTitle: { stringValue: "আমার ব্লগ" },
          postsPerPage: { integerValue: "12" },
          allowIndexing: { booleanValue: true },
          timezone: { stringValue: "Mars/Base" },
          menu: { arrayValue: { values: [] } },
        },
      }),
    });
    const s = await createPublicSettingsSource(opts(f)).read();
    expect(s.siteTitle).toBe("আমার ব্লগ");
    expect(s.postsPerPage).toBe(12);
    expect(s.allowIndexing).toBe(true);
    expect(s.timezone).toBe("Asia/Dhaka"); // অবৈধ → default
  });
  it("URL-এ settings doc ও key; key error-বার্তায় নয়", async () => {
    const f = mk({ status: 500, ok: false });
    await expect(createPublicSettingsSource(opts(f)).read()).rejects.toThrow(/Firestore REST 500/);
    expect(String(f.mock.calls[0][0])).toContain("/documents/siteSettings/main?key=K");
    const err = await createPublicSettingsSource(opts(f)).read().catch((e: Error) => e);
    expect((err as Error).message).not.toContain("key=");
  }, 15_000);
});
