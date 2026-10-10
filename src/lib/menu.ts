// পাবলিক মেনু ও footer-এর pure সহায়ক (Arch §৬ `menu`/`footer`, §১৭ P9a)। SDK/UI-মুক্ত।
// সংরক্ষিত মান owner-সম্পাদিত — তাই পাবলিকে বসানোর আগে সবসময় resolve: draft/মোছা পেজ বা মোছা ক্যাটাগরির আইটেম লুকায়।
import { isHttpUrl } from "./siteSettings";
import { isValidSlug } from "./slug";

export const MENU_MAX = 12;
export const MENU_LABEL_MAX = 40;
export const FOOTER_LINKS_MAX = 8;
export const FOOTER_TEXT_MAX = 200;
export const MENU_REF_MAX = 300;

export const MENU_TYPES = ["page", "category", "link"] as const;
export type MenuType = (typeof MENU_TYPES)[number];
export type MenuItem = { label: string; type: MenuType; ref: string };
export type FooterLink = { label: string; url: string };
export type Footer = { text: string; links: FooterLink[] };

/** site-internal পথ: `/` দিয়ে শুরু; `//host`, backslash ও control-অক্ষর নয় (open-redirect/মিশ্র-scheme এড়াতে) */
export function isInternalPath(u: string): boolean {
  // eslint-disable-next-line no-control-regex
  return u.startsWith("/") && !u.startsWith("//") && !/[\\\u0000-\u001f\u007f\s]/.test(u);
}

/** মেনু/footer লিংক: http(s) বা site-internal পথ (javascript:/data: কখনো নয়) */
export const isSafeHref = (u: string): boolean => isHttpUrl(u) || isInternalPath(u);

/** একটা মেনু-আইটেমের `ref` তার type-এ বৈধ কিনা (page = slug, category = term-id, link = নিরাপদ href) */
export function isValidMenuRef(type: MenuType, ref: string): boolean {
  if (ref.length === 0 || ref.length > MENU_REF_MAX) return false;
  if (type === "page") return isValidSlug(ref);
  if (type === "category") return !/\s/.test(ref);
  return isSafeHref(ref);
}

export type ResolvedLink = { label: string; href: string; external: boolean };
export type MenuCtx = {
  /** শুধু published পেজ */
  pages: readonly { slug: string }[];
  /** পাবলিক ক্যাটাগরি (লেখা-আছে এমন) — id ও পথ */
  categories: readonly { id: string; path: string }[];
};

export const isExternalHref = (href: string): boolean => !href.startsWith("/");

/** মেনু resolve। `null` = owner কিছু বসাননি ⇒ কল-সাইট আগের default মেনু দেখাবে; খালি অ্যারে = সব আইটেম লুকানো */
export function resolveMenu(stored: readonly MenuItem[], ctx: MenuCtx, pagePath: (slug: string) => string): ResolvedLink[] | null {
  if (stored.length === 0) return null;
  const pages = new Set(ctx.pages.map((p) => p.slug));
  const cats = new Map(ctx.categories.map((c) => [c.id, c.path] as const));
  const out: ResolvedLink[] = [];
  for (const it of stored) {
    let href: string | undefined;
    if (it.type === "page") href = pages.has(it.ref) ? pagePath(it.ref) : undefined;
    else if (it.type === "category") href = cats.get(it.ref);
    else href = isSafeHref(it.ref) ? it.ref : undefined;
    if (href) out.push({ label: it.label, href, external: isExternalHref(href) });
  }
  return out;
}

/** footer resolve: text খালি হলে `defaultText`; লিংক খালি হলে null (কল-সাইট default লিংক দেখাবে) */
export function resolveFooter(stored: Footer, defaultText: string): { text: string; links: ResolvedLink[] | null } {
  const links = stored.links.filter((l) => isSafeHref(l.url)).map((l) => ({ label: l.label, href: l.url, external: isExternalHref(l.url) }));
  return { text: stored.text.trim() === "" ? defaultText : stored.text, links: links.length ? links : null };
}
