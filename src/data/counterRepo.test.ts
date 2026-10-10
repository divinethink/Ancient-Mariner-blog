import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type D1Like, cleanupRateLimits, recordView } from "./counterRepo";
import { MAX_POSTS_PER_VISITOR_PER_DAY } from "@/lib/views";
import { readFileSync } from "node:fs";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: {} }) }));

// node:sqlite (Node ≥২২.৫) — vite-এর builtin-তালিকা এড়াতে require দিয়ে
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (p: string) => SqliteDb };
type SqliteDb = { exec(s: string): void; prepare(s: string): { run(...v: unknown[]): { changes: number | bigint }; all(...v: unknown[]): Record<string, unknown>[] } };

function fakeD1(raw: SqliteDb): D1Like {
  return {
    prepare: (sql) => ({
      bind: (...v) => ({ run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...v).changes) } }) }),
    }),
  };
}

let raw: SqliteDb;
let db: D1Like;
const all = (sql: string) => raw.prepare(sql).all();
const view = (o: Partial<Parameters<typeof recordView>[1]> = {}) =>
  recordView(db, { postId: "P1", day: "2026-10-10", country: "BD", referrer: "direct", visitorKey: "v:a", postKey: "p:P1:a", ...o });

beforeEach(() => {
  raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync("migrations/d1/0001_init.sql", "utf8"));
  db = fakeD1(raw);
});

describe("recordView", () => {
  it("প্রথম ভিউ গোনা: viewCounts ও dailyVisitors", async () => {
    expect(await view()).toBe("counted");
    expect(all("SELECT postId, n FROM viewCounts")).toEqual([{ postId: "P1", n: 1 }]);
    expect(all("SELECT day, n FROM dailyVisitors")).toEqual([{ day: "2026-10-10", n: 1 }]);
  });
  it("একই ভিজিটর+পোস্ট+দিন আবার = duplicate, কিছু বাড়ে না (idempotent)", async () => {
    await view();
    expect(await view()).toBe("duplicate");
    expect(all("SELECT n FROM viewCounts")).toEqual([{ n: 1 }]);
    expect(all("SELECT n FROM dailyVisitors")).toEqual([{ n: 1 }]);
  });
  it("একই ভিজিটরের আরেক পোস্ট: ভিউ +১ কিন্তু ভিজিটর একই", async () => {
    await view();
    expect(await view({ postId: "P2", postKey: "p:P2:a" })).toBe("counted");
    expect(all("SELECT n FROM dailyVisitors")).toEqual([{ n: 1 }]);
    expect(all("SELECT COUNT(*) AS c FROM viewCounts")).toEqual([{ c: 2 }]);
  });
  it("ভিন্ন ভিজিটর: একই row-তে n=২, ভিজিটর ২", async () => {
    await view();
    await view({ visitorKey: "v:b", postKey: "p:P1:b" });
    expect(all("SELECT n FROM viewCounts")).toEqual([{ n: 2 }]);
    expect(all("SELECT n FROM dailyVisitors")).toEqual([{ n: 2 }]);
  });
  it("ভিন্ন দেশ/referrer আলাদা row", async () => {
    await view();
    await view({ visitorKey: "v:b", postKey: "p:P1:b", country: "US", referrer: "google.com" });
    expect(all("SELECT COUNT(*) AS c FROM viewCounts")).toEqual([{ c: 2 }]);
  });
  it("একজনের দিনে পোস্ট-সীমা ছাড়ালে limited", async () => {
    let last = "";
    for (let i = 0; i < MAX_POSTS_PER_VISITOR_PER_DAY + 3; i++) last = await view({ postId: `P${i}`, postKey: `p:P${i}:a` });
    expect(last).toBe("limited");
    expect(all("SELECT COUNT(*) AS c FROM viewCounts")).toEqual([{ c: MAX_POSTS_PER_VISITOR_PER_DAY }]);
  });
});

describe("cleanupRateLimits", () => {
  it("পুরনো dedupe row মোছে, viewCounts/dailyVisitors অক্ষত", async () => {
    await view({ day: "2026-10-01", visitorKey: "v:old", postKey: "p:P1:old" });
    await view({ day: "2026-10-10" });
    expect(await cleanupRateLimits(db, "2026-10-08")).toBe(2);
    expect(all("SELECT windowStart FROM rateLimits").every((r) => r.windowStart === "2026-10-10")).toBe(true);
    expect(all("SELECT COUNT(*) AS c FROM viewCounts")).toEqual([{ c: 2 }]);
    expect(all("SELECT COUNT(*) AS c FROM dailyVisitors")).toEqual([{ c: 2 }]);
  });
});
