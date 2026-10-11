import { describe, expect, it } from "vitest";
import {
  chapterSlugBase,
  moveId,
  nextOrder,
  pickFreeSlug,
  planReorder,
  projectProgress,
  projectSlugBase,
  sortByOrder,
  worksPath,
} from "./projects";

const items = (...orders: number[]) => orders.map((order, i) => ({ id: String.fromCharCode(97 + i), order }));

describe("slug", () => {
  it("বাংলা শিরোনাম থেকে slug; খালি হলে id-ভিত্তিক fallback", () => {
    expect(projectSlugBase("প্রাচীন নাবিক", "AbCdEfGh123")).toBe("প্রাচীন-নাবিক");
    expect(projectSlugBase("!!!", "AbCdEfGh123")).toBe("project-abcdefgh");
    expect(chapterSlugBase("", "XyZ123456789")).toBe("chapter-xyz12345");
  });
  it("pickFreeSlug: সংঘাতে -২, -৩…; খালি থাকলে base", () => {
    expect(pickFreeSlug("ক", new Set())).toBe("ক");
    expect(pickFreeSlug("ক", new Set(["ক"]))).toBe("ক-২");
    expect(pickFreeSlug("ক", new Set(["ক", "ক-২"]))).toBe("ক-৩");
  });
  it("pickFreeSlug: সব চেষ্টা ফুরোলে null", () => {
    const taken = new Set<string>(["ক"]);
    for (let n = 2; n <= 50; n++) taken.add(pickFreeSlug("ক", taken) as string);
    expect(pickFreeSlug("ক", taken)).toBeNull();
  });
});

describe("order", () => {
  it("sortByOrder: tie-তে id-ক্রম; nextOrder = max+১", () => {
    expect(sortByOrder([{ id: "b", order: 1 }, { id: "a", order: 1 }, { id: "c", order: 0 }]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(nextOrder([])).toBe(0);
    expect(nextOrder(items(0, 1, 5))).toBe(6);
  });
  it("moveId: এক ধাপ; প্রান্ত/অজানা অপরিবর্তিত", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b"], "z", "up")).toEqual(["a", "b"]);
  });
  it("planReorder: পাশাপাশি অদলবদলে ঠিক ২টা patch (order অদলবদল)", () => {
    const p = planReorder(items(0, 1, 2), ["b", "a", "c"]);
    expect(p).toEqual({ ok: true, patches: [{ id: "b", order: 0 }, { id: "a", order: 1 }] });
  });
  it("planReorder: gap-যুক্ত order-ও সঠিক; idempotent (আবার চালালে খালি)", () => {
    const cur = [{ id: "a", order: 3 }, { id: "b", order: 10 }, { id: "c", order: 11 }];
    const p = planReorder(cur, ["b", "a", "c"]);
    expect(p).toEqual({ ok: true, patches: [{ id: "b", order: 3 }, { id: "a", order: 10 }] });
    const after = [{ id: "b", order: 3 }, { id: "a", order: 10 }, { id: "c", order: 11 }];
    expect(planReorder(after, ["b", "a", "c"])).toEqual({ ok: true, patches: [] });
  });
  it("planReorder: tie থাকলে ০..n-১ পুনর্নম্বর", () => {
    const p = planReorder([{ id: "a", order: 1 }, { id: "b", order: 1 }, { id: "c", order: 2 }], ["b", "a", "c"]);
    expect(p).toEqual({ ok: true, patches: [{ id: "b", order: 0 }] }); // a=1, c=2 আগে থেকেই ঠিক
  });
  it("planReorder: permutation না হলে ব্যর্থ", () => {
    expect(planReorder(items(0, 1), ["a"])).toEqual({ ok: false, reason: "mismatch" });
    expect(planReorder(items(0, 1), ["a", "z"])).toEqual({ ok: false, reason: "mismatch" });
    expect(planReorder(items(0, 1), ["a", "a"])).toEqual({ ok: false, reason: "duplicate-ids" });
  });
});

describe("projectProgress", () => {
  const ch = [
    { status: "published", wordCount: 1000 },
    { status: "draft", wordCount: 500 },
    { status: "trashed", wordCount: 9999 },
  ];
  it("ট্র্যাশ বাদে গণনা; target থাকলে %", () => {
    expect(projectProgress(ch, 3000)).toEqual({ chapters: 2, published: 1, words: 1500, percent: 50 });
  });
  it("target না থাকলে/০ হলে percent null; ১০০-তে সীমিত; খালি তালিকা", () => {
    expect(projectProgress(ch).percent).toBeNull();
    expect(projectProgress(ch, 0).percent).toBeNull();
    expect(projectProgress(ch, 100).percent).toBe(100);
    expect(projectProgress([], 100)).toEqual({ chapters: 0, published: 0, words: 0, percent: 0 });
  });
});

describe("worksPath", () => {
  it("/works, প্রজেক্ট ও অধ্যায় (বাংলা encode)", () => {
    expect(worksPath()).toBe("/works");
    expect(worksPath("p")).toBe("/works/p");
    expect(worksPath("ক", "খ")).toBe(`/works/${encodeURIComponent("ক")}/${encodeURIComponent("খ")}`);
    expect(worksPath(undefined, "খ")).toBe("/works");
  });
});
