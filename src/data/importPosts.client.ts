// পথ ক (owner-CSR): ইমপোর্টের লেখা — প্রতি লেখায় post + নিজের slug-lock এক writeBatch-এ (পূর্ণ সফল বা পূর্ণ ব্যর্থ)।
// সবসময় status=draft + visibility=private (সোর্স-অবস্থা যা-ই হোক)। পুরনো কিছু মোছা/ওভাররাইট হয় না:
// post-id নির্ধারিত, আর বিদ্যমান slug-lock-এ `set` rules-এ update ⇒ নিষিদ্ধ ⇒ দ্বিতীয়বার লিখলে batch ব্যর্থ, কিছু বদলায় না।
import { doc, writeBatch, type Firestore } from "firebase/firestore";
import { PostSchema, SCHEMA_VERSION } from "@/data/postRepo";
import type { ImportDraft } from "@/lib/import/commit";

export type ImportRow = { draft: ImportDraft; categoryId?: string; tagIds: string[] };

// Firestore `undefined` মান নেয় না (nested-সহ)
const compact = <T extends Record<string, unknown>>(o: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export async function commitImportRows(db: Firestore, ownerUid: string, rows: readonly ImportRow[]): Promise<void> {
  const now = new Date();
  const batch = writeBatch(db);
  for (const { draft: d, categoryId, tagIds } of rows) {
    const post = PostSchema.parse({
      title: d.title,
      slug: d.slug,
      slugHistory: [],
      body: d.body,
      excerpt: d.excerpt,
      status: "draft",
      visibility: "private",
      wordCount: d.wordCount,
      ...(categoryId && d.categoryName ? { categoryId, categoryName: d.categoryName } : {}),
      tagIds,
      tagNames: d.tagNames,
      importSource: d.importSource,
      ownerUid,
      createdAt: now,
      updatedAt: now,
    });
    const { importSource, ...rest } = post;
    batch.set(doc(db, "posts", d.id), {
      ...compact(rest),
      ...(importSource ? { importSource: compact(importSource) } : {}),
    });
    batch.set(doc(db, "slugs", d.slug), {
      postId: d.id,
      ownerUid,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    });
  }
  await batch.commit();
}
