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

describe("createComment (P11b-১)", () => {
  const comment = { postId: "P1", authorName: "রহিম", content: "ভালো", status: "approved" as const, ownerUid: "O", createdAt: new Date("2026-10-10T00:00:00Z"), updatedAt: new Date("2026-10-10T00:00:00Z"), schemaVersion: 1 };
  it("শুধু নতুন doc (exists:false) + সব field; parent না থাকলে field নেই", async () => {
    const calls: Call[] = [];
    const db = mk(calls, () => json({}));
    expect(await db.createComment({ id: "C1", comment })).toBe("created");
    const w = JSON.parse(String(calls[0].init.body)).writes[0];
    expect(w.currentDocument).toEqual({ exists: false });
    expect(w.update.name).toBe("projects/proj/databases/(default)/documents/comments/C1");
    expect(w.update.fields.status).toEqual({ stringValue: "approved" });
    expect(w.update.fields.createdAt).toEqual({ timestampValue: "2026-10-10T00:00:00.000Z" });
    expect(w.update.fields.parentCommentId).toBeUndefined();
  });
  it("parentCommentId থাকলে লেখা হয়", async () => {
    const calls: Call[] = [];
    await mk(calls, () => json({})).createComment({ id: "C2", comment: { ...comment, parentCommentId: "P0" } });
    expect(JSON.parse(String(calls[0].init.body)).writes[0].update.fields.parentCommentId).toEqual({ stringValue: "P0" });
  });
  it("ALREADY_EXISTS ⇒ 'exists' (retry/double-submit নিরাপদ)", async () => {
    const db = mk([], () => json({ error: { status: "ALREADY_EXISTS" } }, 409));
    expect(await db.createComment({ id: "C1", comment })).toBe("exists");
  });
  it("৫০০ ⇒ throw", async () => {
    const db = mk([], () => json({}, 500));
    await expect(db.createComment({ id: "C1", comment })).rejects.toThrow();
  });
  it("byOwner (P11b-২) থাকলেই লেখা হয়, নইলে field নেই", async () => {
    const calls: Call[] = [];
    await mk(calls, () => json({})).createComment({ id: "C3", comment: { ...comment, byOwner: true } });
    expect(JSON.parse(String(calls[0].init.body)).writes[0].update.fields.byOwner).toEqual({ booleanValue: true });
  });
});

describe("setCommentStatus (P11b-২)", () => {
  it("শুধু status+updatedAt (mask) ও exists:true — নতুন doc তৈরি হয় না", async () => {
    const calls: Call[] = [];
    expect(await mk(calls, () => json({})).setCommentStatus({ id: "C1", status: "spam", nowMs: Date.parse("2026-10-10T00:00:00Z") })).toBe("ok");
    const w = JSON.parse(String(calls[0].init.body)).writes[0];
    expect(w.update.name).toBe("projects/proj/databases/(default)/documents/comments/C1");
    expect(w.update.fields).toEqual({ status: { stringValue: "spam" }, updatedAt: { timestampValue: "2026-10-10T00:00:00.000Z" } });
    expect(w.updateMask).toEqual({ fieldPaths: ["status", "updatedAt"] });
    expect(w.currentDocument).toEqual({ exists: true });
  });
  it("NOT_FOUND ⇒ 'precondition' (retry নয়); ৫০০ ⇒ throw", async () => {
    expect(await mk([], () => json({ error: { status: "NOT_FOUND" } }, 404)).setCommentStatus({ id: "C1", status: "approved", nowMs: 1 })).toBe("precondition");
    await expect(mk([], () => json({}, 500)).setCommentStatus({ id: "C1", status: "approved", nowMs: 1 })).rejects.toThrow();
  });
});
