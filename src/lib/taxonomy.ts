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
