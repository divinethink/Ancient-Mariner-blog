import { describe, expect, it, vi } from "vitest";
import { findDatabaseId, queryPostViews } from "./popularRepo.server";

const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { status: 200 });

describe("popularRepo.server (D1 REST)", () => {
  it("নাম → uuid, তারপর SELECT; পাওয়া সারি ফেরত", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body as string | undefined });
      return String(url).includes("/query")
        ? ok([{ results: [{ postId: "A", n: 7 }] }])
        : ok([{ uuid: "db-1", name: "blog-counter" }]);
    }) as unknown as typeof fetch;
    const rows = await queryPostViews({ token: "t", accountId: "acc", fetchFn }, "2026-09-11");
    expect(rows).toEqual([{ postId: "A", n: 7 }]);
    expect(calls[0]!.url).toContain("/accounts/acc/d1/database?name=blog-counter");
    expect(calls[1]!.url).toContain("/d1/database/db-1/query");
    expect(JSON.parse(calls[1]!.body!).params).toEqual(["2026-09-11", 50]); // parameterized, SQL-এ মান বসানো নয়
  });
  it("DB না পেলে স্পষ্ট ত্রুটি", async () => {
    const fetchFn = vi.fn(async () => ok([])) as unknown as typeof fetch;
    await expect(queryPostViews({ token: "t", accountId: "a", fetchFn }, "2026-09-11")).rejects.toThrow("পাওয়া যায়নি");
  });
  it("API ব্যর্থ হলে ত্রুটি, token বার্তায় নেই", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ message: "Authentication error" }] }), { status: 403 })) as unknown as typeof fetch;
    const e = await findDatabaseId({ token: "SECRET-TOKEN", accountId: "a", fetchFn }).catch((x: Error) => x);
    expect(String((e as Error).message)).toContain("Authentication error");
    expect(String((e as Error).message)).not.toContain("SECRET-TOKEN");
  });
});
