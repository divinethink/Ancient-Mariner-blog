// Pages-এর pure সহায়ক (SDK/UI-মুক্ত; P4b-১, Arch §৬ `pages`): slug-যাচাই, reserved-তালিকা, system পেজ, পাবলিক পথ।
import { EMPTY_BODY } from "./editorDoc";
import { isValidSlug } from "./slug";

export const PAGE_SCHEMA_VERSION = 1;
export const PAGE_TITLE_MAX = 120;

/**
 * পাবলিক URL `/[slug]` — static রুট ও ফাইল-নামের সাথে সংঘাত এড়াতে reserved (Arch §৬ pages)।
 * নতুন পাবলিক ফোল্ডার/রুট যোগ হলে এই তালিকা হালনাগাদ বাধ্যতামূলক। `.`-যুক্ত slug `isValidSlug`-ই আটকায় (rss.xml, sitemap.xml…)।
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "blog", "category", "tag", "series", "search", "works", "book", "login", "dashboard", "api", "offline", "archive",
  "diary", "shelf", "data", "icons", "_next", "404", "rss", "sitemap", "robots", "build", "manifest", "sw",
]);

export type SystemPage = { slug: string; title: string; body: string };

const doc = (paras: string[]) =>
  JSON.stringify({ type: "doc", content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });

/** `about` ও `privacy` — মোছা যায় না, সম্পাদনা যায়; seed হয় Draft হিসেবে (owner পড়ে নিজে প্রকাশ করবেন) */
export const SYSTEM_PAGES: readonly SystemPage[] = [
  { slug: "about", title: "এই আমি", body: EMPTY_BODY },
  {
    slug: "privacy",
    title: "গোপনীয়তা নীতি",
    body: doc([
      "এই সাইটে পাঠক হিসেবে আপনাকে কোনো অ্যাকাউন্ট খুলতে হয় না, এবং আপনার নাম বা ইমেইল সংগ্রহ করা হয় না।",
      "সাইটের ট্রাফিক বোঝার জন্য কুকি-বিহীন (cookieless) পরিসংখ্যান-সেবা ব্যবহৃত হয়; এতে ব্যক্তিগত পরিচয় সংরক্ষিত হয় না।",
      "এই নীতি সাইটে নতুন সুবিধা (যেমন মন্তব্য) যোগ হলে হালনাগাদ করা হবে।",
    ]),
  },
];
export const isSystemSlug = (slug: string): boolean => SYSTEM_PAGES.some((p) => p.slug === slug);

export type PageSlugCheck = "ok" | "empty" | "invalid" | "reserved";

export function checkPageSlug(slug: string): PageSlugCheck {
  if (slug === "") return "empty";
  if (!isValidSlug(slug)) return "invalid";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return "ok";
}

/** পাবলিক পথ; slug percent-encoded (বাংলা slug-সহ) */
export const pagePath = (slug: string): string => `/${encodeURIComponent(slug)}`;
