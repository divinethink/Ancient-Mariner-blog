import { describe, expect, it } from "vitest";
import {
  candidateTargets,
  chunk,
  isSafeDocId,
  ownedSlugLocks,
  planPurge,
  planRevisionPrune,
  selectPurgeable,
  slugLockCandidates,
  type TrashCandidate,
} from "./prune";

const D = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const trashed = (
  id: string,
  daysAgo: number,
  extra: Partial<TrashCandidate> = {},
): TrashCandidate => ({
  id,
  status: "trashed",
  trashedAt: new Date(NOW - daysAgo * D),
  updateTime: "2026-01-01T00:00:00.000000Z",
  ...extra,
});

describe("isSafeDocId", () => {
  it("বাংলা slug বৈধ", () => expect(isSafeDocId("আমার-লেখা")).toBe(true));
  it("'/', '.', '..', '__x__', খালি, non-string অবৈধ", () => {
    for (const bad of ["a/b", ".", "..", "__name__", "", 5, null, undefined])
      expect(isSafeDocId(bad)).toBe(false);
  });
});

describe("selectPurgeable", () => {
  it("ঠিক ৭ দিন বা বেশি পুরনো নেয়; ৭ দিনের কম নেয় না", () => {
    const r = selectPurgeable([trashed("a", 7), trashed("b", 6.99), trashed("c", 30)], NOW);
    expect(r.map((p) => p.id)).toEqual(["c", "a"]); // পুরনো আগে
  });
  it("status ≠ trashed (published/draft/archived/অন্য) কখনো নয়, যত পুরনোই হোক", () => {
    for (const status of ["published", "draft", "archived", undefined, "TRASHED"]) {
      expect(selectPurgeable([trashed("a", 99, { status })], NOW)).toEqual([]);
    }
  });
  it("trashedAt না থাকলে/অবৈধ হলে/Date না হলে নয়", () => {
    expect(selectPurgeable([trashed("a", 99, { trashedAt: undefined })], NOW)).toEqual([]);
    expect(selectPurgeable([trashed("a", 99, { trashedAt: "2020-01-01" })], NOW)).toEqual([]);
    expect(selectPurgeable([trashed("a", 99, { trashedAt: new Date(NaN) })], NOW)).toEqual([]);
  });
  it("updateTime না থাকলে বা id অবৈধ হলে নয়", () => {
    expect(selectPurgeable([trashed("a", 99, { updateTime: undefined })], NOW)).toEqual([]);
    expect(selectPurgeable([trashed("a/b", 99)], NOW)).toEqual([]);
  });
  it("ভবিষ্যতের trashedAt (ঘড়ি-গোলমাল) নয়", () => {
    expect(selectPurgeable([trashed("a", -5)], NOW)).toEqual([]);
  });
  it("max সীমা মানে", () => {
    const many = Array.from({ length: 20 }, (_, i) => trashed(`p${i}`, 10 + i));
    expect(selectPurgeable(many, NOW, 3)).toHaveLength(3);
    expect(selectPurgeable(many, NOW, 0)).toEqual([]);
  });
});

describe("slugLockCandidates / ownedSlugLocks", () => {
  it("slug + slugHistory, অনন্য, অবৈধ বাদ", () => {
    expect(slugLockCandidates({ slug: "new", slugHistory: ["old", "new", "a/b", 3] })).toEqual([
      "new",
      "old",
    ]);
    expect(slugLockCandidates({ slug: undefined, slugHistory: undefined })).toEqual([]);
  });
  it("শুধু নিজের postId-র lock", () => {
    const docs = [{ id: "mine", postId: "P1" }, { id: "theirs", postId: "P2" }, { id: "nopost" }];
    expect(ownedSlugLocks("P1", docs)).toEqual(["mine"]);
  });
});

describe("planPurge", () => {
  const base = {
    postId: "P1",
    postUpdateTime: "T1",
    revisionIds: ["r1", "r2"],
    slugLockIds: ["s1"],
    revisionsTruncated: false,
  };
  it("ছোট হলে একটাই chunk; posts সবচেয়ে শেষে, precondition-সহ; draft ও slug একই chunk-এ", () => {
    const plan = planPurge(base);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual([
      { collection: "revisions", id: "r1" },
      { collection: "revisions", id: "r2" },
      { collection: "slugs", id: "s1" },
      { collection: "drafts", id: "P1" },
      { collection: "posts", id: "P1", ifUpdateTime: "T1" },
    ]);
  });
  it("বড় হলে revision আলাদা chunk, শেষ chunk = slugs+draft+post", () => {
    const revisionIds = Array.from({ length: 7 }, (_, i) => `r${i}`);
    const plan = planPurge({ ...base, revisionIds, maxPerChunk: 4 });
    expect(plan.map((c) => c.length)).toEqual([4, 3, 3]);
    const last = plan[plan.length - 1];
    expect(last.map((o) => o.collection)).toEqual(["slugs", "drafts", "posts"]);
    // posts আর কোথাও নেই
    expect(plan.flat().filter((o) => o.collection === "posts")).toHaveLength(1);
  });
  it("revisionsTruncated হলে posts/slugs/drafts মোছা নয়", () => {
    const plan = planPurge({ ...base, revisionsTruncated: true });
    expect(plan.flat().every((o) => o.collection === "revisions")).toBe(true);
  });
  it("updateTime বা postId না থাকলে কিছুই নয়", () => {
    expect(planPurge({ ...base, postUpdateTime: undefined })).toEqual([]);
    expect(planPurge({ ...base, postId: "a/b" })).toEqual([]);
  });
  it("revision id অনন্য ও নিরাপদ", () => {
    const plan = planPurge({ ...base, revisionIds: ["r1", "r1", "x/y"] });
    expect(plan[0].filter((o) => o.collection === "revisions").map((o) => o.id)).toEqual(["r1"]);
  });
  it("কোনো chunk সীমা ছাড়ায় না", () => {
    const revisionIds = Array.from({ length: 1234 }, (_, i) => `r${i}`);
    for (const c of planPurge({ ...base, revisionIds, maxPerChunk: 450 }))
      expect(c.length).toBeLessThanOrEqual(450);
  });
});

describe("candidateTargets", () => {
  const recent = [
    { id: "1", targetType: "post", targetId: "A" },
    { id: "2", targetType: "post", targetId: "A" },
    { id: "3", targetType: "chapter", targetId: "B" },
    { id: "4", targetType: "post", targetId: "a/b" },
    { id: "5", targetType: "post", targetId: "C" },
  ];
  it("শুধু post ও নিরাপদ id, অনন্য", () => expect(candidateTargets(recent)).toEqual(["A", "C"]));
  it("max মানে", () => expect(candidateTargets(recent, 1)).toHaveLength(1));
  it("shuffle ফাংশন প্রয়োগ হয়", () =>
    expect(candidateTargets(recent, 5, (a) => [...a].reverse())).toEqual(["C", "A"]));
});

describe("planRevisionPrune", () => {
  const mk = (n: number, targetId = "P1", targetType = "post") => ({
    id: targetType === "post" ? `${targetId}-${n}` : `${targetType}-${targetId}-${n}`,
    targetId,
    targetType,
    versionNumber: n,
  });
  it("২০টা বা কম হলে কিছু মোছা নয়", () => {
    expect(
      planRevisionPrune(
        Array.from({ length: 20 }, (_, i) => mk(i + 1)),
        "P1",
      ),
    ).toEqual([]);
  });
  it("২৩টা হলে সবচেয়ে পুরনো ৩টা (ক্রম যা-ই হোক)", () => {
    const revs = Array.from({ length: 23 }, (_, i) => mk(i + 1)).reverse();
    expect(planRevisionPrune(revs, "P1").sort()).toEqual(["P1-1", "P1-2", "P1-3"]);
  });
  it("সর্বশেষ ২০টা কখনো মোছা হয় না", () => {
    const revs = Array.from({ length: 30 }, (_, i) => mk(i + 1));
    const del = new Set(planRevisionPrune(revs, "P1"));
    for (let n = 11; n <= 30; n++) expect(del.has(`P1-${n}`)).toBe(false);
  });
  it("অন্য লেখা/অন্য type-এর revision ছোঁয় না", () => {
    const revs = [
      ...Array.from({ length: 25 }, (_, i) => mk(i + 1)),
      mk(1, "P2"),
      mk(2, "P1", "chapter"),
    ];
    const del = planRevisionPrune(revs, "P1");
    expect(del.every((id) => id.startsWith("P1-"))).toBe(true);
    expect(del).not.toContain("chapter-P1-2");
    expect(del).toHaveLength(5);
  });
  it("অবৈধ versionNumber-ওয়ালা doc মোছা নয় (keep>0)", () => {
    const revs = [
      ...Array.from({ length: 22 }, (_, i) => mk(i + 1)),
      { id: "bad", targetId: "P1", targetType: "post", versionNumber: "x" },
    ];
    expect(planRevisionPrune(revs, "P1")).not.toContain("bad");
  });
  it("keep=0 (orphan) হলে ঐ target-এর সবই, অন্যের নয়", () => {
    const revs = [mk(1), mk(2), mk(1, "P2")];
    expect(planRevisionPrune(revs, "P1", 0).sort()).toEqual(["P1-1", "P1-2"]);
  });
});

describe("chunk", () => {
  it("ভাগ করে", () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
});
