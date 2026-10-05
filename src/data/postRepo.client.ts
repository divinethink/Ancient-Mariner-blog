// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (Arch §২)।
// শুধু dashboard থেকে dynamic import করা হবে (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  parseDraft,
  parsePost,
  PostNotFoundError,
  PostPatchSchema,
  PostSchema,
  SCHEMA_VERSION,
  SlugTakenError,
  type Draft,
  type PostRepo,
  type PostWithId,
} from "@/data/postRepo";
import {
  decideSlugClaim,
  fallbackSlug,
  isValidSlug,
  nextHistory,
  slugify,
  withSuffix,
} from "@/lib/slug";

const MAX_SLUG_ATTEMPTS = 50;

// Firestore `undefined` মান নেয় না
const compact = <T extends Record<string, unknown>>(o: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function createPostRepoClient(db: Firestore, ownerUid: string): PostRepo {
  const postRef = (id: string) => doc(db, "posts", id);
  const slugRef = (slug: string) => doc(db, "slugs", slug);
  const draftRef = (id: string) => doc(db, "drafts", id);

  async function get(id: string): Promise<PostWithId | null> {
    const snap = await getDoc(postRef(id));
    return snap.exists() ? parsePost(id, snap.data()) : null;
  }

  /** `slugs/{slug}`-এর মালিক post-id; lock না থাকলে null */
  async function slugOwner(slug: string): Promise<string | null> {
    const snap = await getDoc(slugRef(slug));
    return snap.exists() ? String(snap.data().postId ?? "") : null;
  }

  const slugDoc = (postId: string, now: Date) => ({
    postId,
    ownerUid,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  });

  async function create(input: Parameters<PostRepo["create"]>[0]): Promise<PostWithId> {
    const id = input.id ?? doc(collection(db, "posts")).id;
    const existing = await get(id); // retry-নিরাপদ: আগেই তৈরি হয়ে থাকলে অপরিবর্তিত ফেরত
    if (existing) return existing;

    const explicit = input.slug !== undefined && input.slug !== "";
    const base = slugify(explicit ? input.slug! : input.title) || fallbackSlug(id);
    if (!isValidSlug(base)) throw new SlugTakenError(base);
    const attempts = explicit ? 1 : MAX_SLUG_ATTEMPTS;

    for (let n = 1; n <= attempts; n++) {
      const slug = withSuffix(base, n);
      const decision = decideSlugClaim(await slugOwner(slug), id);
      if (decision === "taken") continue;

      const now = new Date();
      const post = PostSchema.parse({
        title: input.title,
        slug,
        slugHistory: [],
        body: input.body,
        excerpt: input.excerpt ?? "",
        status: "draft",
        visibility: input.visibility ?? "private",
        wordCount: input.wordCount ?? 0,
        ownerUid,
        createdAt: now,
        updatedAt: now,
      });
      const batch = writeBatch(db);
      batch.set(postRef(id), compact(post));
      if (decision === "create") batch.set(slugRef(slug), slugDoc(id, now));
      try {
        await batch.commit();
        return { ...post, id };
      } catch (e) {
        // একই মুহূর্তে অন্য কেউ slug নিয়ে নিলে পরের candidate; অন্য কারণে (permission, নেটওয়ার্ক) throw
        if (decision === "create" && (await slugOwner(slug)) !== null) continue;
        throw e;
      }
    }
    throw new SlugTakenError(base);
  }

  async function update(id: string, patchInput: Parameters<PostRepo["update"]>[1]) {
    const patch = PostPatchSchema.parse(patchInput);
    const data: Record<string, unknown> = { ...compact(patch), updatedAt: new Date() };
    if (patch.status === "published" && !patch.publishedAt) {
      const cur = await get(id);
      if (!cur) throw new PostNotFoundError(id);
      // পাবলিক query publishedAt-এর ওপর order করে — প্রকাশিত লেখায় তা বাধ্যতামূলক
      if (!cur.publishedAt) data.publishedAt = new Date();
    }
    await updateDoc(postRef(id), data);
  }

  async function changeSlug(id: string, newSlugRaw: string): Promise<PostWithId> {
    const slug = slugify(newSlugRaw);
    if (!isValidSlug(slug)) throw new SlugTakenError(newSlugRaw);
    const cur = await get(id);
    if (!cur) throw new PostNotFoundError(id);
    if (cur.slug === slug) return cur;

    const decision = decideSlugClaim(await slugOwner(slug), id);
    if (decision === "taken") throw new SlugTakenError(slug);

    const now = new Date();
    const slugHistory = nextHistory(cur.slugHistory, cur.slug, slug);
    const batch = writeBatch(db);
    if (decision === "create") batch.set(slugRef(slug), slugDoc(id, now));
    batch.update(postRef(id), { slug, slugHistory, updatedAt: now });
    await batch.commit();
    return { ...cur, slug, slugHistory, updatedAt: now };
  }

  async function saveEdit(id: string, edit: { title: string; body: string; excerpt: string }) {
    const d = {
      targetType: "post" as const,
      ...edit,
      ownerUid,
      updatedAt: new Date(),
      schemaVersion: SCHEMA_VERSION,
    };
    parseDraft(d); // validate (body-সীমা)
    await setDoc(draftRef(id), d); // idempotent — doc-ID = postId
  }

  async function getDraft(id: string): Promise<Draft | null> {
    const snap = await getDoc(draftRef(id));
    return snap.exists() ? parseDraft(snap.data()) : null;
  }

  async function applyDraft(id: string, wordCount: number): Promise<boolean> {
    const d = await getDraft(id);
    if (!d) return false;
    const patch = PostPatchSchema.parse({
      title: d.title,
      body: d.body,
      excerpt: d.excerpt,
      wordCount,
    });
    const batch = writeBatch(db);
    batch.update(postRef(id), { ...compact(patch), updatedAt: new Date() });
    batch.delete(draftRef(id));
    await batch.commit();
    return true;
  }

  return {
    get,
    create,
    update,
    changeSlug,
    saveEdit,
    getDraft,
    applyDraft,
    discardDraft: (id) => deleteDoc(draftRef(id)),
  };
}
