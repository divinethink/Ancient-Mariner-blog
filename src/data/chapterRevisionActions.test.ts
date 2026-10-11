import { describe, expect, it } from "vitest";
import { currentChapterEdit, restoreChapterRevision, snapshotChapterCurrent } from "@/data/chapterRevisionActions";
import type { ChapterDraft, ChapterWithId, ProjectRepo } from "@/data/projectRepo";
import { scopedRevisionRepo, type CreateRevisionInput, type RevisionRepo, type RevisionWithId } from "@/data/revisionRepo";

const body = (t: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

function fakeRevs() {
  const all: RevisionWithId[] = [];
  const r: RevisionRepo & { all: RevisionWithId[] } = {
    all,
    list: async (t, o) => all.filter((x) => x.targetId === t && x.targetType === (o?.targetType ?? "post")).sort((a, b) => b.versionNumber - a.versionNumber).slice(0, o?.limit ?? 20),
    get: async (id) => all.find((x) => x.id === id) ?? null,
    create: async (i: CreateRevisionInput) => {
      const type = i.targetType ?? "post";
      const v = all.filter((x) => x.targetId === i.targetId && x.targetType === type).length + 1;
      const x = { id: `r${all.length + 1}`, targetType: type, targetId: i.targetId, snapshot: i.snapshot, versionNumber: v, trigger: i.trigger, ownerUid: "o", createdAt: new Date(), updatedAt: new Date(), schemaVersion: 1 } as RevisionWithId;
      all.push(x);
      return x;
    },
  };
  return r;
}

type C = { status: string; title: string; body: string; draft?: { title: string; body: string } };
function fakeProjects(c: C | null) {
  const calls: string[] = [];
  const repo = {
    calls,
    cur: c,
    getChapter: async () => (repo.cur ? ({ id: "c1", projectId: "p1", ...repo.cur } as unknown as ChapterWithId) : null),
    getChapterDraft: async () => (repo.cur?.draft ? ({ ...repo.cur.draft } as unknown as ChapterDraft) : null),
    saveChapterEdit: async (_id: string, e: { title: string; body: string; wordCount: number }) => {
      calls.push(`saveChapterEdit:${e.wordCount}`);
      repo.cur = { ...repo.cur!, draft: { title: e.title, body: e.body } };
      return new Date();
    },
    updateChapter: async (_id: string, patch: { body?: string; wordCount?: number }) => {
      calls.push(`update:${patch.wordCount}`);
      repo.cur = { ...repo.cur!, ...patch } as C;
      return {} as ChapterWithId;
    },
  };
  return repo as typeof repo & ProjectRepo;
}

describe("chapter revisions (P14a-৩)", () => {
  it("প্রকাশিত অধ্যায়ে drafts-এর body; draft-অধ্যায়ে অধ্যায়ের; trashed/নেই ⇒ null", async () => {
    const revs = fakeRevs();
    const pub = fakeProjects({ status: "published", title: "ক", body: body("প্রকাশিত"), draft: { title: "ক২", body: body("সম্পাদনা") } });
    expect((await currentChapterEdit(pub, "c1"))?.body).toBe(body("সম্পাদনা"));
    const made = await snapshotChapterCurrent(pub, revs, "c1", "publish");
    expect(made?.targetType).toBe("chapter");
    expect(made?.snapshot).toBe(body("সম্পাদনা"));
    expect(await snapshotChapterCurrent(pub, revs, "c1", "manual")).toBeNull(); // হুবহু এক
    expect(await snapshotChapterCurrent(fakeProjects({ status: "trashed", title: "ক", body: body("x") }), revs, "c1", "manual")).toBeNull();
    expect(await snapshotChapterCurrent(fakeProjects(null), revs, "c1", "manual")).toBeNull();
    expect((await currentChapterEdit(fakeProjects({ status: "draft", title: "ক", body: body("খসড়া") }), "c1"))?.body).toBe(body("খসড়া"));
  });

  it("scopedRevisionRepo: chapter ও post-এর ইতিহাস আলাদা থাকে (একই id হলেও)", async () => {
    const revs = fakeRevs();
    await revs.create({ targetId: "same", snapshot: body("পোস্ট"), trigger: "manual" });
    await scopedRevisionRepo(revs, "chapter").create({ targetId: "same", snapshot: body("অধ্যায়"), trigger: "manual" });
    expect((await scopedRevisionRepo(revs, "chapter").list("same")).map((r) => r.snapshot)).toEqual([body("অধ্যায়")]);
    expect((await revs.list("same")).map((r) => r.snapshot)).toEqual([body("পোস্ট")]);
  });

  it("Restore (প্রকাশিত): আগে বর্তমানের snapshot, তারপর শুধু drafts-এ (অধ্যায়-doc অক্ষত)", async () => {
    const revs = fakeRevs();
    const projects = fakeProjects({ status: "published", title: "ক", body: body("প্রকাশিত") });
    const old = await scopedRevisionRepo(revs, "chapter").create({ targetId: "c1", snapshot: body("পুরনো"), trigger: "manual" });
    const res = await restoreChapterRevision(projects, revs, old.id);
    expect(res).toEqual({ kind: "restored", published: true });
    expect(projects.calls).toEqual(["saveChapterEdit:1"]);
    expect(projects.cur?.body).toBe(body("প্রকাশিত"));
    expect(projects.cur?.draft?.body).toBe(body("পুরনো"));
    expect((await scopedRevisionRepo(revs, "chapter").list("c1"))[0].snapshot).toBe(body("প্রকাশিত")); // restore-এর আগের অবস্থা সংরক্ষিত
  });

  it("Restore (draft-অধ্যায়): সরাসরি অধ্যায়ে; একই হলে 'same'; post-revision/অজানা ⇒ unavailable (কিছু লেখা হয় না)", async () => {
    const revs = fakeRevs();
    const projects = fakeProjects({ status: "draft", title: "ক", body: body("এখন") });
    const old = await scopedRevisionRepo(revs, "chapter").create({ targetId: "c1", snapshot: body("আগে"), trigger: "manual" });
    expect(await restoreChapterRevision(projects, revs, old.id)).toEqual({ kind: "restored", published: false });
    expect(projects.cur?.body).toBe(body("আগে"));
    expect(await restoreChapterRevision(projects, revs, old.id)).toEqual({ kind: "same" });
    const postRev = await revs.create({ targetId: "c1", snapshot: body("পোস্ট"), trigger: "manual" });
    projects.calls.length = 0;
    expect(await restoreChapterRevision(projects, revs, postRev.id)).toEqual({ kind: "unavailable" });
    expect(await restoreChapterRevision(projects, revs, "nope")).toEqual({ kind: "unavailable" });
    expect(projects.calls).toEqual([]);
  });

  it("snapshot ব্যর্থ হলে Restore হয় না (কিছু হারায় না)", async () => {
    const revs = fakeRevs();
    const projects = fakeProjects({ status: "draft", title: "ক", body: body("এখন") });
    const old = await scopedRevisionRepo(revs, "chapter").create({ targetId: "c1", snapshot: body("আগে"), trigger: "manual" });
    revs.create = async () => {
      throw new Error("boom");
    };
    await expect(restoreChapterRevision(projects, revs, old.id)).rejects.toThrow("boom");
    expect(projects.cur?.body).toBe(body("এখন"));
  });
});
