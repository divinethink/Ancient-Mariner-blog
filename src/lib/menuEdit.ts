// মেনু/footer সম্পাদনার pure সহায়ক (P9a-২; Arch §১৭ P9a)। SDK/UI-মুক্ত।
import { MENU_LABEL_MAX, isSafeHref, isValidMenuRef, type FooterLink, type MenuItem, type MenuType } from "./menu";
import { BLOG_INDEX_PATH } from "./publicSite";

/** i-তম আইটেম d (±1) ঘর সরে; সীমার বাইরে হলে অপরিবর্তিত কপি */
export function moveAt<T>(list: readonly T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  const out = [...list];
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return out;
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, k) => k !== i);

/** type বদলালে ref মোছে (পুরনো type-এর ref নতুনে অবৈধ); label থাকে */
export const withType = (it: MenuItem, type: MenuType): MenuItem => (it.type === type ? it : { ...it, type, ref: "" });

const labelOk = (s: string) => s.trim().length > 0 && s.trim().length <= MENU_LABEL_MAX;

export function menuRowError(it: MenuItem): "label" | "ref" | null {
  if (!labelOk(it.label)) return "label";
  return isValidMenuRef(it.type, it.ref.trim()) ? null : "ref";
}

export function footerLinkError(l: FooterLink): "label" | "url" | null {
  if (!labelOk(l.label)) return "label";
  return isSafeHref(l.url.trim()) ? null : "url";
}

/** আজকের default মেনুর সমতুল্য শুরু-তালিকা (ক্যাটাগরি-dropdown বাদে — owner পছন্দের ক্যাটাগরি যোগ করবেন); `about` শুধু published হলে */
export function seedMenu(
  pages: readonly { slug: string; title: string; status: string }[],
  labels: { home: string; blog: string },
): MenuItem[] {
  const out: MenuItem[] = [
    { label: labels.home, type: "link", ref: "/" },
    { label: labels.blog, type: "link", ref: BLOG_INDEX_PATH },
  ];
  const about = pages.find((p) => p.slug === "about" && p.status === "published");
  if (about) out.push({ label: about.title, type: "page", ref: "about" });
  return out;
}
