import { describe, expect, it } from "vitest";
import { appliesTo, countApplicable, planBulk, type BulkPost } from "./bulk";

const now = new Date("2026-10-06T00:00:00Z");
const d = (s: string) => new Date(s);
const post = (id: string, o: Partial<BulkPost> = {}): BulkPost => ({
  id,
  status: "draft",
  visibility: "private",
  createdAt: d("2026-01-01T00:00:00Z"),
  ...o,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("planBulk — publish", () => {
  it("প্রথম প্রকাশে public + publishedAt=now + ডিফল্ট ক্যাটাগরি", () => {
    const r = planBulk(
      [post("a")],
      { kind: "publish", defaultCategory: { id: "c", name: "অন্যান্য" } },
      now,
    );
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].patch).toEqual({
      status: "published",
      visibility: "public",
      publishedAt: now,
      categoryId: "c",
      categoryName: "অন্যান্য",
    });
    expect(r.updates[0]).toMatchObject({
      touch: true,
      leavesPublished: false,
      affectsPublic: true,
    });
  });
  it("আগে প্রকাশিত ছিল (publishedAt আছে) ⇒ visibility/তারিখ অক্ষত; আগের ক্যাটাগরি অক্ষত", () => {
    const p = post("a", {
      publishedAt: d("2025-05-05T00:00:00Z"),
      categoryId: "x",
      categoryName: "X",
    });
    const r = planBulk([p], { kind: "publish", defaultCategory: { id: "c", name: "O" } }, now);
    expect(r.updates[0].patch).toEqual({ status: "published" });
    expect(r.updates[0].affectsPublic).toBe(false); // private থেকে private-published
  });
  it("published ⇒ unchanged; archived/trashed ⇒ status-skip", () => {
    const r = planBulk(
      [
        post("p", { status: "published" }),
        post("ar", { status: "archived" }),
        post("t", { status: "trashed" }),
      ],
      { kind: "publish" },
      now,
    );
    expect(r.updates).toEqual([]);
    expect(r.skipped).toEqual([
      { id: "p", reason: "unchanged" },
      { id: "ar", reason: "status" },
      { id: "t", reason: "status" },
    ]);
  });
});

describe("planBulk — status ক্রিয়া", () => {
  const pub = post("p", { status: "published", visibility: "public" });
  it("unpublish: published থেকে draft, leavesPublished ও affectsPublic", () => {
    const u = planBulk([pub], { kind: "unpublish" }, now).updates[0];
    expect(u).toMatchObject({
      patch: { status: "draft" },
      touch: true,
      leavesPublished: true,
      affectsPublic: true,
    });
  });
  it("unpublish: archived → draft (leavesPublished নয়); draft ⇒ unchanged", () => {
    const r = planBulk([post("a", { status: "archived" }), post("d")], { kind: "unpublish" }, now);
    expect(r.updates[0].leavesPublished).toBe(false);
    expect(r.skipped).toEqual([{ id: "d", reason: "unchanged" }]);
  });
  it("archive: draft/published প্রযোজ্য, archived unchanged, trashed skip", () => {
    const r = planBulk(
      [post("d"), pub, post("a", { status: "archived" }), post("t", { status: "trashed" })],
      { kind: "archive" },
      now,
    );
    expect(ids(r.updates)).toEqual(["d", "p"]);
    expect(r.updates[1].leavesPublished).toBe(true);
    expect(r.skipped.map((s) => s.reason)).toEqual(["unchanged", "status"]);
  });
  it("trash: trashedAt=now; trashed বাদ; published public ⇒ affectsPublic", () => {
    const r = planBulk([post("d"), pub, post("t", { status: "trashed" })], { kind: "trash" }, now);
    expect(r.updates.map((u) => [u.id, u.trashedAt, u.leavesPublished, u.affectsPublic])).toEqual([
      ["d", now, false, false],
      ["p", now, true, true],
    ]);
    expect(r.skipped).toEqual([{ id: "t", reason: "status" }]);
  });
  it("restore: trashed → draft + trashedAt=null; অন্যরা skip", () => {
    const r = planBulk([post("t", { status: "trashed" }), post("d")], { kind: "restore" }, now);
    expect(r.updates[0]).toMatchObject({ id: "t", patch: { status: "draft" }, trashedAt: null });
    expect(r.skipped).toEqual([{ id: "d", reason: "status" }]);
  });
  it("deleteForever: plan-এ কোনো update নেই", () => {
    const r = planBulk([post("t", { status: "trashed" })], { kind: "deleteForever" }, now);
    expect(r.updates).toEqual([]);
  });
});

describe("planBulk — metadata (updatedAt ছোঁয়া নয়)", () => {
  it("visibility: একই ⇒ unchanged; বদলালে touch=false, published হলে affectsPublic", () => {
    const r = planBulk(
      [
        post("a"),
        post("b", { visibility: "public" }),
        post("p", { status: "published", visibility: "public" }),
      ],
      { kind: "visibility", to: "private" },
      now,
    );
    expect(r.updates.map((u) => [u.id, u.touch, u.affectsPublic])).toEqual([
      ["b", false, false],
      ["p", false, true],
    ]);
    expect(r.skipped).toEqual([{ id: "a", reason: "unchanged" }]);
  });
  it("category: id+নাম জোড়ায়; আগেই একই ⇒ unchanged; trashed skip", () => {
    const r = planBulk(
      [
        post("a"),
        post("b", { categoryId: "c", categoryName: "C" }),
        post("t", { status: "trashed" }),
      ],
      { kind: "category", id: "c", name: "C" },
      now,
    );
    expect(r.updates[0].patch).toEqual({ categoryId: "c", categoryName: "C" });
    expect(r.skipped).toEqual([
      { id: "b", reason: "unchanged" },
      { id: "t", reason: "status" },
    ]);
  });
  it("series: createdAt-ক্রমে start থেকে পর্ব-নম্বর; trashed নম্বর খায় না; পুনরায় চালালে unchanged", () => {
    const posts = [
      post("late", { createdAt: d("2026-03-01T00:00:00Z") }),
      post("early", { createdAt: d("2026-01-01T00:00:00Z") }),
      post("t", { status: "trashed", createdAt: d("2026-02-01T00:00:00Z") }),
      post("mid", { createdAt: d("2026-02-01T00:00:00Z") }),
    ];
    const r = planBulk(posts, { kind: "series", id: "s", start: 3 }, now);
    expect(r.updates.map((u) => [u.id, u.patch.seriesOrder])).toEqual([
      ["late", 5],
      ["early", 3],
      ["mid", 4],
    ]);
    const again = planBulk(
      posts.map((p) => ({
        ...p,
        ...(r.updates.find((u) => u.id === p.id)
          ? {
              seriesId: "s",
              seriesOrder: r.updates.find((u) => u.id === p.id)!.patch.seriesOrder as number,
            }
          : {}),
      })),
      { kind: "series", id: "s", start: 3 },
      now,
    );
    expect(again.updates).toEqual([]);
  });
});

describe("appliesTo / countApplicable", () => {
  it("সংখ্যা-গণনা planner-এর নিয়মেই", () => {
    expect(countApplicable("publish", ["draft", "draft", "published", "archived", "trashed"])).toBe(
      3,
    );
    expect(countApplicable("trash", ["draft", "trashed"])).toBe(1);
    expect(appliesTo("deleteForever", "draft")).toBe(false);
  });
});
