// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (Arch §২)।
// শুধু dashboard থেকে dynamic import করা হবে (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
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
  TrashRequiredError,
  type Draft,
  type PostRepo,
  type PostWithId,
} from "@/data/postRepo";
import { countWords, docToText, parseBody } from "@/lib/editorDoc";
import { FIND_LIMIT, matchesFind, serverKey, titleRange, type FindOpts } from "@/lib/postFind";
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

  async function list(opts: { limit?: number } = {}): Promise<PostWithId[]> {
    // single-field index (auto); status-ফিল্টার UI-তে, composite index ছাড়াই
    const q = query(collection(db, "posts"), orderBy("updatedAt", "desc"), limit(opts.limit ?? 20));
    const snap = await getDocs(q);
    const out: PostWithId[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parsePost(d.id, d.data()));
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return out;
  }

  async function find(opts: FindOpts): Promise<PostWithId[]> {
    const col = collection(db, "posts");
    const lim = limit(opts.limit ?? FIND_LIMIT);
    const key = serverKey(opts);
    const q =
      key === "prefix"
        ? query(col, orderBy("title"), where("title", ">=", titleRange(opts.titlePrefix ?? "")[0]), where("title", "<=", titleRange(opts.titlePrefix ?? "")[1]), lim)
        : key === "category"
          ? query(col, where("categoryId", "==", opts.categoryId), orderBy("updatedAt", "desc"), lim) // composite index (firestore.indexes.json)
          : key === "type"
            ? query(col, where("contentType", "==", opts.contentType), orderBy("updatedAt", "desc"), lim) // composite index
            : query(col, orderBy("updatedAt", "desc"), lim);
    const out: PostWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        const p = parsePost(d.id, d.data());
        if (matchesFind(p, opts)) out.push(p);
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
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

  async function update(id: string, patchInput: Parameters<PostRepo["update"]>[1]): Promise<Date> {
    const patch = PostPatchSchema.parse(patchInput);
    const updatedAt = new Date();
    // null → ফিল্ড সরানো (সংগঠন-ফিল্ড clear)
    const data: Record<string, unknown> = {
      ...Object.fromEntries(
        Object.entries(compact(patch)).map(([k, v]) => [k, v === null ? deleteField() : v]),
      ),
      updatedAt,
    };
    if (patch.status === "published" && !patch.publishedAt) {
      const cur = await get(id);
      if (!cur) throw new PostNotFoundError(id);
      // পাবলিক query publishedAt-এর ওপর order করে — প্রকাশিত লেখায় তা বাধ্যতামূলক
      if (!cur.publishedAt) data.publishedAt = new Date();
    }
    await updateDoc(postRef(id), data);
    return updatedAt;
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

  async function saveEdit(
    id: string,
    edit: { title: string; body: string; excerpt: string },
  ): Promise<Date> {
    const updatedAt = new Date();
    const d = {
      targetType: "post" as const,
      ...edit,
      ownerUid,
      updatedAt,
      schemaVersion: SCHEMA_VERSION,
    };
    parseDraft(d); // validate (body-সীমা)
    await setDoc(draftRef(id), d); // idempotent — doc-ID = postId
    return updatedAt;
  }

  async function getDraft(id: string): Promise<Draft | null> {
    const snap = await getDoc(draftRef(id));
    return snap.exists() ? parseDraft(snap.data()) : null;
  }

  async function applyDraft(id: string, wordCount: number): Promise<Date | null> {
    const d = await getDraft(id);
    if (!d) return null;
    const patch = PostPatchSchema.parse({
      title: d.title,
      body: d.body,
      excerpt: d.excerpt,
      wordCount,
    });
    const updatedAt = new Date();
    const batch = writeBatch(db);
    batch.update(postRef(id), { ...compact(patch), updatedAt });
    batch.delete(draftRef(id));
    await batch.commit();
    return updatedAt;
  }

  async function trash(id: string): Promise<void> {
    const cur = await get(id);
    if (!cur) throw new PostNotFoundError(id);
    if (cur.status === "trashed") return; // idempotent
    const now = new Date();
    const data: Record<string, unknown> = { status: "trashed", trashedAt: now, updatedAt: now };
    const batch = writeBatch(db);
    const d = await getDraft(id);
    if (d) {
      // প্রকাশিত লেখার অপ্রকাশিত সম্পাদনা হারায় না — আগে posts-এ কপি (Arch §১২)
      Object.assign(data, {
        title: d.title,
        body: d.body,
        excerpt: d.excerpt,
        wordCount: countWords(docToText(parseBody(d.body))),
      });
      batch.delete(draftRef(id));
    }
    batch.update(postRef(id), data);
    await batch.commit();
  }

  async function restore(id: string): Promise<void> {
    const cur = await get(id);
    if (!cur) throw new PostNotFoundError(id);
    if (cur.status !== "trashed") return;
    await updateDoc(postRef(id), { status: "draft", trashedAt: deleteField(), updatedAt: new Date() });
  }

  async function deletePermanently(id: string): Promise<void> {
    const cur = await get(id);
    if (!cur) {
      await deleteDoc(draftRef(id)); // post আগেই গেছে — retry-নিরাপদ, পড়ে-থাকা draft সাফ
      return;
    }
    if (cur.status !== "trashed") throw new TrashRequiredError(id);
    const batch = writeBatch(db);
    for (const s of new Set([cur.slug, ...cur.slugHistory])) {
      if ((await slugOwner(s)) === id) batch.delete(slugRef(s)); // অন্যের lock ছোঁয়া নয়
    }
    batch.delete(draftRef(id));
    batch.delete(postRef(id));
    await batch.commit();
  }

  async function listTrashed(): Promise<PostWithId[]> {
    // single-field index (auto), composite ছাড়াই; সাজানো UI-তে
    const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "trashed"), limit(100)));
    const out: PostWithId[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parsePost(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function emptyTrash(): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    for (const p of await listTrashed()) {
      try {
        await deletePermanently(p.id);
        deleted++;
      } catch {
        failed++; // বাকিগুলো চলে; ব্যর্থ থাকে — আবার চেষ্টা করা যায়
      }
    }
    return { deleted, failed };
  }

  return {
    get,
    list,
    create,
    update,
    changeSlug,
    saveEdit,
    getDraft,
    applyDraft,
    discardDraft: (id) => deleteDoc(draftRef(id)),
    trash,
    restore,
    deletePermanently,
    find,
    listTrashed,
    emptyTrash,
  };
}
