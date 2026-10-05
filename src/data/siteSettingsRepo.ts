// siteSettingsRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: .client.ts (পথ ক), .server.ts (পথ খ)।
// P2c-১-এ সম্পাদনাযোগ্য ফিল্ড: নাম, ট্যাগলাইন, থিম-default, timezone, postsPerPage, ইনডেক্স/AI-crawler টগল।
// পরের phase-এর ফিল্ড (menu/footer/layout/design/authorBio…) এই schema-য় নেই — সেভ `merge` বলে সেগুলো অক্ষত থাকে।
import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { Theme } from "@/lib/enums";
import {
  DEFAULT_POSTS_PER_PAGE,
  POSTS_PER_PAGE_RANGE,
  SITE_TITLE_MAX,
  TAGLINE_MAX,
  isValidTimeZone,
} from "@/lib/siteSettings";
import { bn } from "@/i18n/bn";

const fields = {
  siteTitle: z.string().trim().min(1).max(SITE_TITLE_MAX),
  tagline: z.string().trim().max(TAGLINE_MAX),
  defaultTheme: Theme,
  timezone: z.string().refine(isValidTimeZone, "timezone ঠিক নয়"),
  postsPerPage: z.number().int().min(POSTS_PER_PAGE_RANGE.min).max(POSTS_PER_PAGE_RANGE.max),
  allowIndexing: z.boolean(),
  blockAiCrawlers: z.boolean(),
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
};

/** Defensive read: প্রতিটা ফিল্ড আলাদাভাবে যাচাই — অবৈধ/অনুপস্থিত মান শুধু সেই ফিল্ডের default-এ ফেরে */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [k, schema] of Object.entries(fields)) {
    const r = schema.safeParse(o[k]);
    if (r.success) out[k] = r.data;
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
