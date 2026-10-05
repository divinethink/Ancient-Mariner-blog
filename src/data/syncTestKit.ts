// শুধু test-এর জন্য: in-memory PostRepo ও KV (production bundle-এ import হয় না)
import type { CreatePostInput, Draft, PostRepo, PostWithId } from "@/data/postRepo";

export function memoryKV() {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k: string, v: unknown) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
    keys: async () => [...m.keys()],
  };
}

export function fakeRepo(t = { now: 1000 }) {
  const posts = new Map<string, PostWithId>();
  const drafts = new Map<string, Draft>();
  const tick = () => new Date(++t.now);
  const calls: string[] = [];
  const repo: PostRepo = {
    get: async (id) => posts.get(id) ?? null,
    list: async () => [...posts.values()],
    create: async (i: CreatePostInput) => {
      calls.push("create");
      const id = i.id ?? "gen";
      const ex = posts.get(id);
      if (ex) return ex;
      const at = tick();
      const p = {
        id, title: i.title, slug: id, slugHistory: [], contentType: "post", body: i.body,
        excerpt: i.excerpt ?? "", status: "draft", visibility: "private", wordCount: i.wordCount ?? 0,
        ownerUid: "o", createdAt: at, updatedAt: at, schemaVersion: 1,
      } as PostWithId;
      posts.set(id, p);
      return p;
    },
    update: async (id, patch) => {
      calls.push("update");
      const at = tick();
      posts.set(id, { ...posts.get(id)!, ...patch, updatedAt: at } as PostWithId);
      return at;
    },
    changeSlug: async (id) => posts.get(id)!,
    saveEdit: async (id, e) => {
      calls.push("saveEdit");
      const at = tick();
      drafts.set(id, { targetType: "post", ...e, ownerUid: "o", updatedAt: at, schemaVersion: 1 });
      return at;
    },
    getDraft: async (id) => drafts.get(id) ?? null,
    applyDraft: async (id, wc) => {
      const d = drafts.get(id);
      if (!d) return null;
      const at = tick();
      posts.set(id, { ...posts.get(id)!, title: d.title, body: d.body, excerpt: d.excerpt, wordCount: wc, updatedAt: at });
      drafts.delete(id);
      return at;
    },
    discardDraft: async (id) => void drafts.delete(id),
  };
  return { repo, posts, drafts, calls, t };
}
