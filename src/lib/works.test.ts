import { describe, expect, it } from "vitest";
import { buildWorks, chapterNeighbors, worksWordTotal, type WorkChapterIn, type WorkProjectIn } from "./works";

const d = (n: number) => new Date(2026, 9, n);
const P = (id: string, o: Partial<WorkProjectIn> = {}): WorkProjectIn => ({
  id, slug: id, title: id, description: "", type: "novel", status: "published", visibility: "public", createdAt: d(1), updatedAt: d(1), ...o,
});
const C = (id: string, projectId: string, order: number, o: Partial<WorkChapterIn> = {}): WorkChapterIn => ({
  id, projectId, slug: id, title: id, body: "", wordCount: 10, order, status: "published", visibility: "public", updatedAt: d(1), ...o,
});

describe("buildWorks", () => {
  it("শুধু published+public প্রজেক্ট ও অধ্যায়; অধ্যায় order-ক্রমে", () => {
    const w = buildWorks(
      [P("a"), P("priv", { visibility: "private" }), P("drf", { status: "draft" })],
      [C("c2", "a", 2), C("c1", "a", 1), C("cd", "a", 0, { status: "draft" }), C("cp", "a", 0, { visibility: "private" }), C("ct", "a", 0, { status: "trashed" }), C("x", "priv", 0)],
    );
    expect(w.map((x) => x.project.id)).toEqual(["a"]);
    expect(w[0].chapters.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
  it("প্রজেক্ট নতুন-হালনাগাদ আগে; অধ্যায়হীন প্রজেক্ট থাকে", () => {
    const w = buildWorks([P("old", { updatedAt: d(1) }), P("new", { updatedAt: d(5) })], []);
    expect(w.map((x) => x.project.id)).toEqual(["new", "old"]);
    expect(w[0].chapters).toEqual([]);
  });
  it("অন্য প্রজেক্টের অধ্যায় মেশে না; একই slug-এর সংঘাতে প্রথমটা", () => {
    const w = buildWorks([P("a", { slug: "s" }), P("b", { slug: "s", updatedAt: d(0) })], [C("c1", "a", 0, { slug: "x" }), C("c2", "a", 1, { slug: "x" }), C("c3", "b", 0)]);
    expect(w).toHaveLength(1);
    expect(w[0].chapters.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("chapterNeighbors / worksWordTotal", () => {
  const cs = [C("1", "a", 0), C("2", "a", 1), C("3", "a", 2)];
  it("আগের/পরের", () => {
    expect(chapterNeighbors(cs, "1")).toMatchObject({ index: 0, total: 3, prev: undefined });
    expect(chapterNeighbors(cs, "2")?.prev?.id).toBe("1");
    expect(chapterNeighbors(cs, "2")?.next?.id).toBe("3");
    expect(chapterNeighbors(cs, "3")?.next).toBeUndefined();
    expect(chapterNeighbors(cs, "nope")).toBeNull();
  });
  it("শব্দ-যোগ", () => expect(worksWordTotal(cs)).toBe(30));
});
