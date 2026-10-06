import { describe, expect, it } from "vitest";
import { createBackupDocWriter } from "./backupDoc";

const valid = () => ({
  type: "auto",
  format: "json",
  status: "complete",
  driveFolderId: "FOLDER1",
  counts: { posts: 3, slugs: 3 },
  completedAt: new Date("2026-10-07T20:05:00Z"),
  ownerUid: "OWNER",
  createdAt: new Date("2026-10-07T20:05:00Z"),
  updatedAt: new Date("2026-10-07T20:05:00Z"),
  schemaVersion: 1,
});
type Call = { url: string; init: RequestInit };
const mk = (respond: () => Response, calls: Call[]) =>
  createBackupDocWriter({
    projectId: "proj",
    getToken: async () => "TOK",
    fetchImpl: (async (u: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(u), init: init ?? {} });
      return respond();
    }) as typeof fetch,
  });

describe("createBackupDocWriter", () => {
  it("একটাই write: নতুন doc + exists:false precondition; fields সঠিক কাঠামোয়", async () => {
    const calls: Call[] = [];
    expect(await mk(() => new Response("{}"), calls).create("bk-20261007-2000", valid())).toBe("created");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:commit");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer TOK");
    const w = JSON.parse(calls[0].init.body as string).writes;
    expect(w).toHaveLength(1);
    expect(w[0].currentDocument).toEqual({ exists: false });
    expect(w[0].delete).toBeUndefined();
    expect(w[0].update.name).toBe("projects/proj/databases/(default)/documents/backups/bk-20261007-2000");
    expect(w[0].update.fields.counts.mapValue.fields.posts).toEqual({ integerValue: "3" });
    expect(w[0].update.fields.completedAt).toEqual({ timestampValue: "2026-10-07T20:05:00.000Z" });
    expect(w[0].update.fields.driveFolderId).toEqual({ stringValue: "FOLDER1" });
  });
  it("ALREADY_EXISTS → 'exists' (retry নেই, overwrite নেই)", async () => {
    const calls: Call[] = [];
    const r = await mk(() => new Response(JSON.stringify({ error: { status: "ALREADY_EXISTS" } }), { status: 409 }), calls).create("bk1", valid());
    expect(r).toBe("exists");
    expect(calls).toHaveLength(1);
  });
  it("অন্য ত্রুটি throw; অবৈধ id/meta পাঠানোর আগেই আটকায়", async () => {
    const calls: Call[] = [];
    await expect(mk(() => new Response("x", { status: 403 }), calls).create("bk1", valid())).rejects.toThrow();
    const c2: Call[] = [];
    const w = mk(() => new Response("{}"), c2);
    await expect(w.create("../x", valid())).rejects.toThrow();
    await expect(w.create("bk2", { ...valid(), driveFolderId: "" })).rejects.toThrow();
    expect(c2).toHaveLength(0);
  });
});
