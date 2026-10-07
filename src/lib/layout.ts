// পাবলিক sidebar/Home-সেকশনের ক্রম ও চালু-বন্ধ (Arch §৬ `layout`, §১৭ P4b-৩)। pure, SDK/UI-মুক্ত।
// সংরক্ষিত মান আংশিক/পুরনো/অজানা-id-যুক্ত হতে পারে — তাই default-এর সাথে মিলিয়ে সবসময় পূর্ণ তালিকা (defensive read)।
export type LayoutItem = { id: string; enabled: boolean };

export const SIDEBAR_WIDGETS = ["facebook", "category", "links", "follow", "recent", "author"] as const;
export type SidebarWidget = (typeof SIDEBAR_WIDGETS)[number];
export const HOME_SECTIONS = ["hero", "featured", "recent"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** default ক্রম ও অবস্থা: recent ও author শুরুতে বন্ধ (Mockup §৫); facebook/links খালি থাকলে এমনিতেই লুকানো */
export const DEFAULT_SIDEBAR: readonly { id: SidebarWidget; enabled: boolean }[] = [
  { id: "facebook", enabled: true },
  { id: "category", enabled: true },
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
): { id: T; enabled: boolean }[] {
  const known = new Map(defaults.map((d) => [d.id as string, d] as const));
  const seen = new Set<string>();
  const out: { id: T; enabled: boolean }[] = [];
  for (const s of stored) {
    if (!known.has(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id as T, enabled: s.enabled });
  }
  for (const d of defaults) if (!seen.has(d.id)) out.push({ ...d });
  return out;
}
