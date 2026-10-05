// taxonomy-এর pure নিয়ম (SDK/UI-মুক্ত): slug-ভিত্তি ও category-parent যাচাই (Arch §৬/§১৭ P3a)।
import { fallbackSlug, slugify } from "./slug";

/** নাম থেকে slug-ভিত্তি; বাংলা নাম Unicode-preserving; খালি হলে id থেকে fallback */
export function termSlugBase(name: string, id: string): string {
  return slugify(name) || fallbackSlug(id).replace(/^post-/, "term-");
}

export type ParentCheck = { ok: true } | { ok: false; reason: string };

/**
 * category-parent নিয়ম: নিজের parent নিজে নয়; parent অবশ্যই বিদ্যমান ও শীর্ষ-স্তরের (সর্বোচ্চ ২ স্তর);
 * যে category-র সন্তান আছে সে অন্যের সন্তান হতে পারবে না।
 */
export function checkParent(
  selfId: string,
  parent: { id: string; parentCategoryId?: string } | null,
  selfHasChildren: boolean,
): ParentCheck {
  if (!parent) return { ok: false, reason: "parent ক্যাটাগরি পাওয়া যায়নি" };
  if (parent.id === selfId) return { ok: false, reason: "নিজের সন্তান হওয়া যায় না" };
  if (parent.parentCategoryId) return { ok: false, reason: "সর্বোচ্চ ২ স্তর — parent নিজেই সন্তান" };
  if (selfHasChildren) return { ok: false, reason: "সন্তান থাকা ক্যাটাগরি অন্যের সন্তান হতে পারে না" };
  return { ok: true };
}

/** Firestore batch ≤ ৫০০ অপারেশন — নিরাপদ ছোট chunk */
export const BATCH_CHUNK = 400;
export function chunk<T>(items: readonly T[], size = BATCH_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** ট্যাগ-rename-এ পোস্টের `tagNames` — প্রয়োজন না থাকলে null (idempotent: আবার চালালে null) */
export function renamedTagNames(
  tagIds: readonly string[],
  tagNames: readonly string[],
  id: string,
  name: string,
): string[] | null {
  const idx = tagIds.indexOf(id);
  if (idx < 0 || tagNames[idx] === name) return null;
  const next = tagIds.map((_, i) => tagNames[i] ?? "");
  next[idx] = name;
  return next;
}

/** এর বেশি term থাকলে তালিকায় প্রতিটার ব্যবহার-সংখ্যা আগেই গোনা হয় না (Firestore read সাশ্রয়); মোছার সময় সংখ্যা আসে */
export const COUNT_LIST_LIMIT = 60;

export type TreeRow<T> = { term: T; depth: 0 | 1 };

/**
 * category-তালিকা → parent-এর নিচে সন্তান (নাম-ক্রমে) সাজানো সারি (Mockup §৭.১৩, ২ স্তর)।
 * parent মোছা/অনুপস্থিত হলে সন্তান শীর্ষ-স্তরে দেখায় — কিছু হারায় না।
 */
export function buildCategoryTree<T extends { id: string; name: string; parentCategoryId?: string }>(
  terms: readonly T[],
): TreeRow<T>[] {
  const ids = new Set(terms.map((t) => t.id));
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "bn");
  const isChild = (t: T) => !!t.parentCategoryId && ids.has(t.parentCategoryId);
  const out: TreeRow<T>[] = [];
  for (const top of terms.filter((t) => !isChild(t)).sort(byName)) {
    out.push({ term: top, depth: 0 });
    for (const kid of terms.filter((t) => t.parentCategoryId === top.id).sort(byName)) {
      out.push({ term: kid, depth: 1 });
    }
  }
  return out;
}

/** parent-হিসেবে বাছাইযোগ্য ক্যাটাগরি: নিজে নয়, অন্যের সন্তান নয়, আর সন্তান থাকলে কোনো parent-ই নয় */
export function parentChoices<T extends { id: string; parentCategoryId?: string }>(
  terms: readonly T[],
  selfId: string | null,
): T[] {
  if (selfId && terms.some((t) => t.parentCategoryId === selfId)) return [];
  return terms.filter((t) => !t.parentCategoryId && t.id !== selfId);
}
