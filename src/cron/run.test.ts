import { afterEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";
import { runScheduled } from "./run";

const NOW = 1_800_000_000_000;
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

  it("খালি trash ও revision হলে সফল; কোনো commit/delete নেই; শুধু token + ২টা query", async () => {
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
    expect(seen.filter((u) => u.endsWith(":runQuery"))).toHaveLength(2);
    expect(seen.filter((u) => u.includes("oauth2"))).toHaveLength(1);
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
    await expect(runScheduled(env, NOW)).rejects.toThrow(/1টি কাজ ব্যর্থ/);
    expect(seen).toContain("revisions"); // prune তবু চলেছে
  }, 20000);
});
