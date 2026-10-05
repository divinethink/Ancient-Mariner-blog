import { describe, expect, it } from "vitest";
import { convertIdeaToPost } from "./ideaConvert";
import { IdeaNotFoundError, type IdeaWithId } from "./ideaRepo";
import type { PostWithId } from "./postRepo";

const now = new Date("2026-10-06T00:00:00Z");
const idea = (o: Partial<IdeaWithId> = {}): IdeaWithId => ({
  id: "idea00000000000001",
  text: "রাতের আকাশ\n\nজোনাকি",
  type: "quick",
  ownerUid: "u",
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1,
  ...o,
});

function kit(initialIdea: IdeaWithId | null) {
  let cur = initialIdea;
  const posts = new Map<string, { title: string; body: string }>();
  const calls = { create: 0, mark: 0 };
  return {
    calls,
    posts,
    ideas: {
      get: async () => cur,
      markConverted: async (_id: string, postId: string) => {
        calls.mark++;
        cur = { ...cur!, convertedToPostId: postId };
        return cur;
      },
    },
    postsRepo: {
      get: async (id: string) => (posts.has(id) ? ({ id } as PostWithId) : null),
      create: async (i: { id?: string; title: string; body: string }) => {
        calls.create++;
        if (!posts.has(i.id!)) posts.set(i.id!, { title: i.title, body: i.body });
        return { id: i.id! } as PostWithId;
      },
    },
  };
}

describe("convertIdeaToPost", () => {
  it("পোস্ট বানায় (id = আইডিয়া-id) ও convertedToPostId বসায়", async () => {
    const k = kit(idea({ title: "জোনাক" }));
    const r = await convertIdeaToPost(k.ideas, k.postsRepo, "idea00000000000001");
    expect(r).toEqual({ postId: "idea00000000000001", created: true });
    expect(k.posts.get("idea00000000000001")?.title).toBe("জোনাক");
    expect(k.calls).toEqual({ create: 1, mark: 1 });
  });

  it("দ্বিতীয়বার (double-tap/retry) আর কোনো লেখা বানায় না", async () => {
    const k = kit(idea());
    await convertIdeaToPost(k.ideas, k.postsRepo, "idea00000000000001");
    const r = await convertIdeaToPost(k.ideas, k.postsRepo, "idea00000000000001");
    expect(r).toEqual({ postId: "idea00000000000001", created: false });
    expect(k.calls).toEqual({ create: 1, mark: 1 });
  });

  it("পোস্ট তৈরি হয়েছে কিন্তু mark হয়নি (মাঝপথে থামা) — আবার চালালে শুধু mark সম্পূর্ণ, duplicate নয়", async () => {
    const k = kit(idea());
    k.posts.set("idea00000000000001", { title: "", body: "{}" });
    const r = await convertIdeaToPost(k.ideas, k.postsRepo, "idea00000000000001");
    expect(r.postId).toBe("idea00000000000001");
    expect(k.posts.size).toBe(1);
    expect(k.calls.mark).toBe(1);
  });

  it("convertedToPostId আছে কিন্তু পোস্ট স্থায়ীভাবে মোছা — আবার তৈরি হয়", async () => {
    const k = kit(idea({ convertedToPostId: "idea00000000000001" }));
    const r = await convertIdeaToPost(k.ideas, k.postsRepo, "idea00000000000001");
    expect(r.created).toBe(true);
    expect(k.posts.size).toBe(1);
  });

  it("আইডিয়া না থাকলে IdeaNotFoundError", async () => {
    const k = kit(null);
    await expect(convertIdeaToPost(k.ideas, k.postsRepo, "x")).rejects.toBeInstanceOf(
      IdeaNotFoundError,
    );
  });
});
