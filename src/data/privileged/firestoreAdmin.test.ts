import { describe, expect, it } from "vitest";
import { BudgetExceeded, createAdminDb, createBudget } from "./firestoreAdmin";

type Call = { url: string; init: RequestInit };
function fake(respond: (call: Call) => Response, calls: Call[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} };
    calls.push(c);
    return respond(c);
  }) as typeof fetch;
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const mk = (calls: Call[], respond: (c: Call) => Response, max = 45) =>
  createAdminDb({
    projectId: "proj",
    getToken: async () => "TOK",
    budget: createBudget(max),
    fetchImpl: fake(respond, calls),
  });

describe("createAdminDb", () => {
  it("runQuery: URL, Bearer, body; doc decode + updateTime", async () => {
    const calls: Call[] = [];
    const db = mk(calls, () =>
      json([
        {
          document: {
            name: "projects/proj/databases/(default)/documents/posts/P1",
            updateTime: "U1",
            fields: { status: { stringValue: "trashed" } },
          },
        },
        { readTime: "x" },
      ]),
    );
    const r = await db.runQuery({ from: [{ collectionId: "posts" }], limit: 5 });
    expect(calls[0].url).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:runQuery",
    );
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer TOK");
    expect(r.docs).toEqual([{ id: "P1", updateTime: "U1", data: { status: "trashed" } }]);
    expect(r.truncatedAt).toBeUndefined();
  });

  it("runQuery: ফল == limit হলে truncatedAt", async () => {
    const doc = (i: number) => ({
      document: { name: `projects/proj/databases/(default)/documents/revisions/r${i}`, fields: {} },
    });
    const db = mk([], () => json([doc(1), doc(2)]));
    expect((await db.runQuery({ limit: 2 })).truncatedAt).toBe(2);
  });

  it("batchGet: found/missing আলাদা; খালি ids-এ network নেই", async () => {
    const calls: Call[] = [];
    const db = mk(calls, () =>
      json([
        {
          found: {
            name: "projects/proj/databases/(default)/documents/slugs/আমার",
            fields: { postId: { stringValue: "P1" } },
          },
        },
        { missing: "projects/proj/databases/(default)/documents/slugs/gone" },
      ]),
    );
    expect(await db.batchGet("slugs", [], ["postId"])).toEqual({ found: [], missing: [] });
    expect(calls).toHaveLength(0);
    const r = await db.batchGet("slugs", ["আমার", "gone"], ["postId"]);
    expect(r.found[0]).toMatchObject({ id: "আমার", data: { postId: "P1" } });
    expect(r.missing).toEqual(["gone"]);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.mask).toEqual({ fieldPaths: ["postId"] });
    expect(body.documents[0]).toBe("projects/proj/databases/(default)/documents/slugs/আমার");
  });

  it("commitDeletes: শুধু delete write; precondition updateTime যায়", async () => {
    const calls: Call[] = [];
    const db = mk(calls, () => json({}));
    const res = await db.commitDeletes([
      { collection: "revisions", id: "r1" },
      { collection: "posts", id: "P1", ifUpdateTime: "U1" },
    ]);
    expect(res).toBe("ok");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.writes).toEqual([
      { delete: "projects/proj/databases/(default)/documents/revisions/r1" },
      {
        delete: "projects/proj/databases/(default)/documents/posts/P1",
        currentDocument: { updateTime: "U1" },
      },
    ]);
    for (const w of body.writes)
      expect(Object.keys(w).filter((k) => k !== "delete" && k !== "currentDocument")).toEqual([]);
  });

  it("commitDeletes: FAILED_PRECONDITION → 'precondition' (retry নেই); অন্য ত্রুটি throw", async () => {
    const calls: Call[] = [];
    const db = mk(calls, () => json({ error: { status: "FAILED_PRECONDITION" } }, 400));
    expect(await db.commitDeletes([{ collection: "posts", id: "P", ifUpdateTime: "U" }])).toBe(
      "precondition",
    );
    expect(calls).toHaveLength(1);
    const bad = mk([], () => json({ error: { status: "PERMISSION_DENIED" } }, 403));
    await expect(bad.commitDeletes([{ collection: "revisions", id: "r" }])).rejects.toThrow(/403/);
  });

  it("খালি ops-এ network নেই", async () => {
    const calls: Call[] = [];
    expect(await mk(calls, () => json({})).commitDeletes([])).toBe("ok");
    expect(calls).toHaveLength(0);
  });

  it("budget শেষে BudgetExceeded", async () => {
    const db = mk([], () => json([]), 2);
    await db.runQuery({});
    await db.runQuery({});
    await expect(db.runQuery({})).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
