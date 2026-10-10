import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readComments, writeComments, type CommentRow } from "./commentSnapshot";

const row = (id: string, postId = "P1"): CommentRow => ({ id, postId, authorName: "রহিম", content: "ভালো", createdAt: new Date("2026-10-10T00:00:00Z") });

describe("comment snapshot", () => {
  it("লিখে পড়লে একই (Date সহ)", async () => {
    const p = join(await mkdtemp(join(tmpdir(), "cm-")), "c.json");
    await writeComments([{ ...row("a"), byOwner: true, parentCommentId: "z" }, row("b", "P2")], p);
    expect(await readComments(p)).toEqual([{ ...row("a"), byOwner: true, parentCommentId: "z" }, row("b", "P2")]);
  });
  it("ফাইল নেই/বিকৃত ⇒ খালি (সাইট অক্ষত)", async () => {
    const d = await mkdtemp(join(tmpdir(), "cm-"));
    expect(await readComments(join(d, "none.json"))).toEqual([]);
    await writeFile(join(d, "bad.json"), "{oops");
    expect(await readComments(join(d, "bad.json"))).toEqual([]);
    await writeFile(join(d, "shape.json"), JSON.stringify({ items: [{ id: 1 }] }));
    expect(await readComments(join(d, "shape.json"))).toEqual([]);
  });
  it("অবৈধ তারিখের row বাদ", async () => {
    const p = join(await mkdtemp(join(tmpdir(), "cm-")), "c.json");
    await writeFile(p, JSON.stringify({ items: [{ ...row("a"), createdAt: "nope" }, { ...row("b"), createdAt: "2026-10-10T00:00:00.000Z" }] }));
    expect((await readComments(p)).map((r) => r.id)).toEqual(["b"]);
  });
});
