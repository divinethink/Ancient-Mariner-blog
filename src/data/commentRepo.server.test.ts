import { describe, expect, it, vi } from "vitest";
import { CommentsForbidden, createPublicCommentSource } from "./commentRepo.server";

vi.mock("@/config/env", () => ({ getEnv: () => ({ FIREBASE_PROJECT_ID: "p", FIREBASE_SERVER_API_KEY: "k", SITE_URL: "https://x.test" }) }));

const rdoc = (id: string, f: Record<string, unknown>) => ({
  document: {
    name: `projects/p/databases/(default)/documents/comments/${id}`,
    fields: {
      postId: { stringValue: "P1" },
      authorName: { stringValue: "রহিম" },
      content: { stringValue: "ভালো" },
      ownerUid: { stringValue: "O" },
      createdAt: { timestampValue: "2026-10-10T00:00:00Z" },
      updatedAt: { timestampValue: "2026-10-10T00:00:00Z" },
      status: { stringValue: "approved" },
      ...f,
    },
  },
});
const mk = (res: () => Response) => {
  const f = vi.fn(async () => res());
  return { src: createPublicCommentSource({ projectId: "p", apiKey: "k", fetchImpl: f as unknown as typeof fetch }), f };
};

describe("createPublicCommentSource", () => {
  it("approved query (explicit status filter) ও field-ম্যাপ; ownerUid বাইরে যায় না", async () => {
    const { src, f } = mk(() => new Response(JSON.stringify([rdoc("C1", { byOwner: { booleanValue: true }, parentCommentId: { stringValue: "C0" } })])));
    const out = await src.listApproved();
    expect(out).toEqual([{ id: "C1", postId: "P1", authorName: "রহিম", content: "ভালো", createdAt: new Date("2026-10-10T00:00:00Z"), parentCommentId: "C0", byOwner: true }]);
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.structuredQuery.where.fieldFilter.value).toEqual({ stringValue: "approved" });
  });
  it("অ-approved ও বিকৃত doc বাদ, বাকিগুলো থাকে", async () => {
    const { src } = mk(() => new Response(JSON.stringify([rdoc("C1", { status: { stringValue: "spam" } }), rdoc("C2", { content: { stringValue: "" } }), rdoc("C3", {}), {}])));
    expect((await src.listApproved()).map((c) => c.id)).toEqual(["C3"]);
  });
  it("৪০৩ ⇒ CommentsForbidden (build rules-deploy-এর আগে থামে না); ৫০০ ⇒ সাধারণ throw", async () => {
    await expect(mk(() => new Response("{}", { status: 403 })).src.listApproved()).rejects.toBeInstanceOf(CommentsForbidden);
    await expect(mk(() => new Response("{}", { status: 500 })).src.listApproved()).rejects.toThrow(/500/);
  }, 20000);
});
