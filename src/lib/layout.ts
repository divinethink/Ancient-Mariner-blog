// পাবলিক sidebar/Home-সেকশনের ক্রম ও চালু-বন্ধ (Arch §৬ `layout`, §১৭ P4b-৩)। pure, SDK/UI-মুক্ত।
// সংরক্ষিত মান আংশিক/পুরনো/অজানা-id-যুক্ত হতে পারে — তাই default-এর সাথে মিলিয়ে সবসময় পূর্ণ তালিকা (defensive read)।
export type LayoutItem = { id: string; enabled: boolean; /** owner-দেওয়া নিজের নাম (ঐচ্ছিক; খালি = ডিফল্ট) */ title?: string };
export const LAYOUT_TITLE_MAX = 40;

export const SIDEBAR_WIDGETS = ["search", "facebook", "category", "popular", "archive", "calendar", "shelf", "links", "follow", "recent", "author"] as const;
export type SidebarWidget = (typeof SIDEBAR_WIDGETS)[number];
export const HOME_SECTIONS = ["hero", "featured", "recent"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** default ক্রম ও অবস্থা: recent ও author শুরুতে বন্ধ (Mockup §৫); facebook/links খালি থাকলে এমনিতেই লুকানো */
export const DEFAULT_SIDEBAR: readonly { id: SidebarWidget; enabled: boolean }[] = [
  { id: "search", enabled: true },
  { id: "facebook", enabled: true },
  { id: "category", enabled: true },
  { id: "popular", enabled: true }, // P11a-২: ডেটা না থাকলে (গণনা শুরু হয়নি) এমনিতেই লুকানো
  { id: "archive", enabled: true },
  { id: "calendar", enabled: true },
  { id: "shelf", enabled: true }, // দিনলিপি-ঘ: পাবলিক বইয়ের মধ্যে 'পড়ছি' না থাকলে এমনিতেই লুকানো
  { id: "links", enabled: true },
  { id: "follow", enabled: true },
  { id: "recent", enabled: false },
  { id: "author", enabled: false },
];
export const DEFAULT_HOME: readonly { id: HomeSection; enabled: boolean }[] = [
  { id: "hero", enabled: true },
  { id: "featured", enabled: true },
  { id: "recent", enabled: true },
];

/** সংরক্ষিত ক্রম আগে (অজানা/ডুপ্লিকেট id বাদ), তারপর বাদ-পড়া default-গুলো নিজের default অবস্থায় */
export function resolveLayout<T extends string>(
  stored: readonly LayoutItem[],
  defaults: readonly { id: T; enabled: boolean }[],
): { id: T; enabled: boolean; title?: string }[] {
  const known = new Map(defaults.map((d) => [d.id as string, d] as const));
  const seen = new Set<string>();
  const out: { id: T; enabled: boolean; title?: string }[] = [];
  for (const s of stored) {
    if (!known.has(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    const title = s.title?.trim().slice(0, LAYOUT_TITLE_MAX);
    out.push({ id: s.id as T, enabled: s.enabled, ...(title && { title }) });
  }
  for (const d of defaults) if (!seen.has(d.id)) out.push({ ...d });
  return out;
}

/** একটা widget-এর নিজের নাম (সংরক্ষিত তালিকা থেকে); না থাকলে/খালি হলে `fallback` */
export function widgetTitle(stored: readonly LayoutItem[], id: string, fallback: string): string {
  return stored.find((x) => x.id === id)?.title?.trim() || fallback;
}

/** সম্পাদনার পর: খালি/ফাঁকা `title` ফিল্ডটাই সরানো, বাকিটা trim ও সীমিত (সংরক্ষণ ও dirty-তুলনার আগে) */
export function cleanTitles<T extends { title?: string }>(rows: readonly T[]): T[] {
  return rows.map(({ title, ...r }) => {
    const t = title?.trim().slice(0, LAYOUT_TITLE_MAX);
    return (t ? { ...r, title: t } : r) as T;
  });
}
