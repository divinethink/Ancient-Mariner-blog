// siteSettingsRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: .client.ts (পথ ক), .server.ts (পথ খ)।
// সম্পাদনাযোগ্য ফিল্ড: নাম, ট্যাগলাইন, থিম-default, timezone, postsPerPage, ইনডেক্স/AI-crawler টগল (P2c-১); authorBio, feedItems, feedMode (P4b-২)।
// socialLinks.facebook, links, layout (sidebar/home ক্রম) — পাঠ P4b-৩; menu, footer — পাঠ P9a-১ (খালি = আগের default); সম্পাদনা UI P9a-২/৩। design (accent/fontPair/cardStyle) — P9b-১ (খালি/অজানা = ডিফল্ট; সম্পাদনা UI P9b-২; logoMediaId/bannerMediaId একই map-এ)। পরের phase-এর ফিল্ড (logo/banner…) এই schema-য় নেই — সেভ `merge` বলে সেগুলো অক্ষত থাকে।
import { LAYOUT_TITLE_MAX } from "@/lib/layout";
import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { FeedMode, Theme } from "@/lib/enums";
import {
  AUTHOR_BIO_MAX,
  DEFAULT_FEED_ITEMS,
  DEFAULT_POSTS_PER_PAGE,
  FEED_ITEMS_RANGE,
  LINKS_MAX,
  URL_MAX,
  isFollowItAction,
  isHttpUrl,
  POSTS_PER_PAGE_RANGE,
  SITE_TITLE_MAX,
  TAGLINE_MAX,
  isValidTimeZone,
} from "@/lib/siteSettings";
import { bn } from "@/i18n/bn";
import { ACCENTS, CARD_STYLES, DEFAULT_DESIGN, DEFAULT_HEAD, FONT_PAIRS, HEAD_FONTS, HEAD_SIZES, MEDIA_ID_MAX } from "@/lib/design";
import {
  FOOTER_LINKS_MAX,
  FOOTER_TEXT_MAX,
  MENU_LABEL_MAX,
  MENU_MAX,
  MENU_REF_MAX,
  MENU_TYPES,
  isSafeHref,
  isValidMenuRef,
} from "@/lib/menu";

const HttpUrl = z.string().trim().max(URL_MAX).refine(isHttpUrl, "http/https URL দরকার");
const FollowItUrl = z.string().trim().max(URL_MAX).refine(isFollowItAction, "follow.it ফর্ম-ঠিকানা দরকার");
const LayoutItem = z.object({ id: z.string().min(1).max(40), enabled: z.boolean(), title: z.string().max(LAYOUT_TITLE_MAX).optional() }); // title: owner-দেওয়া নিজের নাম (ঐচ্ছিক; পুরনো doc-এ নেই)

const SafeHref = z.string().trim().max(URL_MAX).refine(isSafeHref, "http/https বা '/' দিয়ে শুরু পথ দরকার");
const MenuItemSchema = z
  .object({
    label: z.string().trim().min(1).max(MENU_LABEL_MAX),
    type: z.enum(MENU_TYPES),
    ref: z.string().trim().min(1).max(MENU_REF_MAX),
  })
  .refine((m) => isValidMenuRef(m.type, m.ref), { message: "ref এই type-এর জন্য বৈধ নয়", path: ["ref"] });

// প্রতিটা উপ-ফিল্ড আলাদাভাবে `.catch` — একটা অজানা মান পুরো design নষ্ট করে না
const DesignSchema = z.object({
  accent: z.enum(ACCENTS).catch(DEFAULT_DESIGN.accent),
  fontPair: z.enum(FONT_PAIRS).catch(DEFAULT_DESIGN.fontPair),
  cardStyle: z.enum(CARD_STYLES).catch(DEFAULT_DESIGN.cardStyle),
  logoMediaId: z.string().trim().max(MEDIA_ID_MAX).catch(""), // P9b-২; খালি = নেই
  bannerMediaId: z.string().trim().max(MEDIA_ID_MAX).catch(""),
  // নাম/স্লোগানের ফন্ট-সাইজ (additive; পুরনো ডকে না থাকলে ডিফল্ট)
  titleFont: z.enum(HEAD_FONTS).catch(DEFAULT_HEAD.titleFont),
  titleSize: z.enum(HEAD_SIZES).catch(DEFAULT_HEAD.titleSize),
  taglineFont: z.enum(HEAD_FONTS).catch(DEFAULT_HEAD.taglineFont),
  taglineSize: z.enum(HEAD_SIZES).catch(DEFAULT_HEAD.taglineSize),
});

const fields = {
  siteTitle: z.string().trim().min(1).max(SITE_TITLE_MAX),
  tagline: z.string().trim().max(TAGLINE_MAX),
  defaultTheme: Theme,
  timezone: z.string().refine(isValidTimeZone, "timezone ঠিক নয়"),
  postsPerPage: z.number().int().min(POSTS_PER_PAGE_RANGE.min).max(POSTS_PER_PAGE_RANGE.max),
  allowIndexing: z.boolean(),
  blockAiCrawlers: z.boolean(),
  authorBio: z.string().trim().max(AUTHOR_BIO_MAX),
  feedItems: z.number().int().min(FEED_ITEMS_RANGE.min).max(FEED_ITEMS_RANGE.max),
  feedMode: FeedMode,
  subscribeUrl: z.union([z.literal(""), FollowItUrl]).optional(), // ইমেইল-সাবস্ক্রাইব (follow.it); খালি/নেই = ফর্ম লুকানো; পুরনো doc-এ নেই
  socialLinks: z.object({ facebook: z.union([z.literal(""), HttpUrl]) }),
  links: z.array(z.object({ label: z.string().trim().min(1).max(60), url: HttpUrl })).max(LINKS_MAX),
  layout: z.object({ sidebar: z.array(LayoutItem).max(30), home: z.array(LayoutItem).max(30) }),
  menu: z.array(MenuItemSchema).max(MENU_MAX),
  design: DesignSchema,
  footer: z.object({
    text: z.string().trim().max(FOOTER_TEXT_MAX),
    links: z.array(z.object({ label: z.string().trim().min(1).max(MENU_LABEL_MAX), url: SafeHref })).max(FOOTER_LINKS_MAX),
  }),
};

/** সেভের আগের কঠোর যাচাই (client+server) */
export const SiteSettingsInputSchema = z.object(fields);
export type SiteSettings = z.infer<typeof SiteSettingsInputSchema>;

/**
 * doc না থাকলে/ফিল্ড অবৈধ হলে এই মান। `allowIndexing=false` ইচ্ছাকৃত (fail-closed, owner-অনুমোদিত ২০২৬-১০-০৫):
 * Arch §৬-এর 'শুরুর true'-এর বদলে — লঞ্চ-যাচাইয়ের আগে সাইট ভুলে indexable হয় না; owner Settings-এ চালু করবেন।
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  siteTitle: bn.siteName,
  tagline: "",
  defaultTheme: "light",
  timezone: DEFAULT_TIMEZONE,
  postsPerPage: DEFAULT_POSTS_PER_PAGE,
  allowIndexing: false,
  blockAiCrawlers: false,
  authorBio: "",
  feedItems: DEFAULT_FEED_ITEMS,
  feedMode: "full",
  socialLinks: { facebook: "" },
  links: [],
  layout: { sidebar: [], home: [] },
  menu: [],
  footer: { text: "", links: [] },
  design: { ...DEFAULT_DESIGN, ...DEFAULT_HEAD, logoMediaId: "", bannerMediaId: "" },
};

/** Defensive read: প্রতিটা ফিল্ড আলাদাভাবে যাচাই — অবৈধ/অনুপস্থিত মান শুধু সেই ফিল্ডের default-এ ফেরে */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [k, schema] of Object.entries(fields)) {
    const r = schema.safeParse(o[k]);
    if (r.success && r.data !== undefined) out[k] = r.data; // ঐচ্ছিক ফিল্ড অনুপস্থিত হলে key-ই থাকে না (Firestore undefined নেয় না)
  }
  return out as SiteSettings;
}

/** পথ ক (owner-CSR) */
export interface SiteSettingsRepo {
  get(): Promise<SiteSettings>;
  /** কঠোর যাচাই + শুধু এই ফিল্ডগুলোর `merge` লেখা (idempotent); যাচাই ব্যর্থ হলে throw */
  save(input: SiteSettings): Promise<SiteSettings>;
}

/** পথ খ (build-সময়ে unauthenticated REST) */
export interface PublicSettingsSource {
  read(): Promise<SiteSettings>;
}
