import { afterEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";
import { runScheduled } from "./run";

// ভারী-কাজের ৬-ঘণ্টা স্লটের শুরু (UTC ঘণ্টা %৬==০, মিনিট ০) — P11c-১: Cron ১৫ মিনিটে, ভারী ধাপ শুধু এই স্লটে
const NOW = 1799992800000;
const OFF_SLOT = NOW + 3_600_000;
async function envWithKey() {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  return {
    FIREBASE_PROJECT_ID: "proj",
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
      client_email: "svc@proj.iam.gserviceaccount.com",
      private_key: await exportPKCS8(privateKey),
    }),
  };
}
const stubFetch = (fn: (url: string, body: unknown) => Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return fn(u, body);
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runScheduled", () => {
  it("env মিসিং হলে throw (fail-closed), কোনো network নয়", async () => {
    stubFetch(() => new Response("{}"));
    await expect(runScheduled({ FIREBASE_PROJECT_ID: "proj" }, NOW)).rejects.toThrow(
      /FIREBASE_SERVICE_ACCOUNT/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ভারী স্লটে খালি হলে সফল; কোনো commit/delete নেই; token + ৩টা query (publishDue, trash, revision)", async () => {
    const env = await envWithKey();
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      if (url.includes("oauth2.googleapis.com"))
        return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
      return new Response(JSON.stringify([{ readTime: "x" }]));
    });
    await runScheduled(env, NOW);
    expect(seen.filter((u) => u.endsWith(":commit"))).toEqual([]);
    expect(seen.filter((u) => u.endsWith(":runQuery"))).toHaveLength(3);
    expect(seen.filter((u) => u.includes("oauth2"))).toHaveLength(1);
  });

  it("ভারী স্লটের বাইরে শুধু publishDue-র ১টা query", async () => {
    const env = await envWithKey();
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
      return new Response(JSON.stringify([{ readTime: "x" }]));
    });
    await runScheduled(env, OFF_SLOT);
    expect(seen.filter((u) => u.endsWith(":runQuery"))).toHaveLength(1);
  });

  it("সময়-হওয়া লেখা publish হলে rebuild dispatch; token না থাকলে dispatch নেই কিন্তু সফল", async () => {
    const base = await envWithKey();
    const mk = (withGh: boolean) => {
      const urls: string[] = [];
      stubFetch((url) => {
        urls.push(url);
        if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
        if (url.endsWith(":runQuery"))
          return new Response(
            JSON.stringify([{ document: { name: "projects/proj/databases/(default)/documents/posts/p1", updateTime: "2026-01-01T00:00:00Z", fields: { status: { stringValue: "scheduled" }, scheduledAt: { timestampValue: new Date(OFF_SLOT - 60_000).toISOString() } } } }]),
          );
        if (url.endsWith(":commit")) return new Response("{}");
        if (url.includes("api.github.com")) return new Response(null, { status: 204 });
        return new Response("{}");
      });
      return { urls, env: withGh ? { ...base, GITHUB_TOKEN: "gh", GITHUB_REPO: "o/r" } : base };
    };
    const a = mk(true);
    await runScheduled(a.env, OFF_SLOT);
    expect(a.urls.filter((u) => u.endsWith(":commit"))).toHaveLength(1);
    expect(a.urls.filter((u) => u.includes("api.github.com"))).toHaveLength(1);
    vi.unstubAllGlobals();
    const b = mk(false);
    await runScheduled(b.env, OFF_SLOT);
    expect(b.urls.filter((u) => u.endsWith(":commit"))).toHaveLength(1);
    expect(b.urls.filter((u) => u.includes("api.github.com"))).toHaveLength(0);
  });

  it("এক কাজ ব্যর্থ হলেও অন্যটা চলে; শেষে throw", async () => {
    const env = await envWithKey();
    const seen: string[] = [];
    stubFetch((url, body) => {
      if (url.includes("oauth2.googleapis.com"))
        return new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }));
      const q = (body as { structuredQuery?: { from?: { collectionId: string }[] } })
        .structuredQuery;
      seen.push(q?.from?.[0].collectionId ?? "?");
      return q?.from?.[0].collectionId === "posts"
        ? new Response("boom", { status: 500 })
        : new Response("[]");
    });
    await expect(runScheduled(env, NOW)).rejects.toThrow(/2টি কাজ ব্যর্থ/);
    expect(seen).toContain("revisions"); // prune তবু চলেছে
  }, 20000);
});
