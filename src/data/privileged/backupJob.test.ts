import { describe, expect, it } from "vitest";
import { runBackupJob, type BackupJobDeps } from "./backupJob";
import { BACKUP_COLLECTIONS } from "../../lib/backup";

const NOW = new Date("2026-10-08T20:00:00Z");
const log = { info: () => undefined, warn: () => undefined };

function mk(
  over: Partial<BackupJobDeps> = {},
  data: Record<string, { id: string; data: Record<string, unknown> }[]> = {},
) {
  const uploads: { folder: string; name: string; content: string }[] = [];
  const deleted: string[] = [];
  const docs: { id: string; meta: Record<string, unknown> }[] = [];
  const deps: BackupJobDeps = {
    readPage: async (col, cursor) => {
      const all = data[col] ?? [];
      const start = cursor ? Number(cursor) : 0;
      const docs2 = all.slice(start, start + 2);
      return { docs: docs2, next: start + 2 < all.length ? String(start + 2) : undefined };
    },
    drive: {
      createFolder: async (name) => ({ id: "FOLDER_NEW", name }),
      uploadJson: async (folder, name, content) => {
        uploads.push({ folder, name, content });
        return { id: `f${uploads.length}`, name, size: Buffer.byteLength(content, "utf8") };
      },
      listBackupFolders: async () => [
        { id: "FOLDER_NEW", name: "ancient-mariner-backup-20261008-2000" },
        { id: "OLD_INCOMPLETE", name: "ancient-mariner-backup-20260901-2000" },
        { id: "OTHER", name: "my-photos" },
      ],
      deleteFolder: async (id) => void deleted.push(id),
    },
    writeDoc: async (id, meta) => (
      docs.push({ id, meta: meta as Record<string, unknown> }),
      "created"
    ),
    listCompleted: async () => [],
    type: "auto",
    now: () => NOW,
    log,
    ...over,
  };
  return { deps, uploads, deleted, docs };
}

const posts = [1, 2, 3].map((n) => ({
  id: `p${n}`,
  data: { ownerUid: "OWN", title: `t${n}`, createdAt: new Date("2026-01-01T00:00:00Z") },
}));

describe("runBackupJob", () => {
  it("সব collection-এর ফাইল, pagination ও timestamp-encode; doc লেখা; ownerUid পড়া doc থেকে", async () => {
    const { deps, uploads, docs } = mk({}, { posts });
    const r = await runBackupJob(deps);
    expect(uploads).toHaveLength(BACKUP_COLLECTIONS.length);
    expect(r.counts.posts).toBe(3);
    expect(r.total).toBe(3);
    const f = JSON.parse(uploads.find((u) => u.name === "posts.json")!.content);
    expect(f.collections.posts).toHaveLength(3);
    expect(f.collections.posts[0].data.createdAt).toEqual({
      $timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(f.counts).toEqual({ posts: 3 });
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("ancient-mariner-backup-20261008-2000");
    expect(docs[0].meta.ownerUid).toBe("OWN");
    expect(docs[0].meta.driveFolderId).toBe("FOLDER_NEW");
  });

  it("আকার না মিললে throw — doc লেখা বা মোছা নয়", async () => {
    const { deps, docs, deleted } = mk(
      {
        drive: { ...mk().deps.drive, uploadJson: async (_f, name) => ({ id: "x", name, size: 1 }) },
      },
      { posts },
    );
    await expect(runBackupJob(deps)).rejects.toThrow(/আকার মেলেনি/);
    expect(docs).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("সব খালি হলে throw — কিছু মোছা নয়", async () => {
    const { deps, docs, deleted } = mk();
    await expect(runBackupJob(deps)).rejects.toThrow(/খালি/);
    expect(docs).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("সফল হলে retention: বাইরের ফোল্ডার ও নতুনটা অক্ষত; পুরনো অসম্পূর্ণ (>২৪ঘ) মোছা", async () => {
    const { deps, deleted } = mk({}, { posts });
    const r = await runBackupJob(deps);
    expect(deleted).toEqual(["OLD_INCOMPLETE"]);
    expect(r.removedFolders).toBe(1);
    expect(r.retentionOk).toBe(true);
  });

  it("retention ব্যর্থ হলেও backup সফল (throw নয়)", async () => {
    const { deps } = mk({ listCompleted: async () => Promise.reject(new Error("x")) }, { posts });
    const r = await runBackupJob(deps);
    expect(r.retentionOk).toBe(false);
    expect(r.total).toBe(3);
  });

  it("বড় collection ভাগ হয় (<col>-<N>.json)", async () => {
    const big = Array.from({ length: 3 }, (_, i) => ({
      id: `n${i}`,
      data: { body: "x".repeat(60) },
    }));
    const { deps, uploads } = mk({}, { notes: big });
    const { splitIntoParts } = await import("../../lib/backupPolicy");
    expect(splitIntoParts(big, () => 100, 150).length).toBe(3); // নীতি যাচাই; job ডিফল্ট ১০MB-এ এক ফাইল
    await runBackupJob(deps);
    expect(uploads.some((u) => u.name === "notes.json")).toBe(true);
  });
});
