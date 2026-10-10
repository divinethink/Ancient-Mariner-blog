// Sidebar/Home/লিংক-তালিকা সম্পাদনার pure সহায়ক (P9a-৩; Arch §১৭ P9a)। SDK/UI-মুক্ত। ক্রম-বদল = `menuEdit.moveAt`।
import { URL_MAX, isHttpUrl } from "./siteSettings";

export const LINK_LABEL_MAX = 60; // siteSettingsRepo-র `links[].label`-এর সীমার সাথে মেলে

export type SiteLink = { label: string; url: string };

/** i-তম সারির চালু/বন্ধ উল্টায়; সীমার বাইরে হলে অপরিবর্তিত কপি */
export function toggleAt<T extends { enabled: boolean }>(list: readonly T[], i: number): T[] {
  return list.map((x, k) => (k === i ? { ...x, enabled: !x.enabled } : { ...x }));
}

/** ফেসবুক URL: খালি চলে (= widget লুকানো); নইলে শুধু http/https */
export function facebookError(url: string): boolean {
  const u = url.trim();
  return u !== "" && (u.length > URL_MAX || !isHttpUrl(u));
}

export function siteLinkError(l: SiteLink): "label" | "url" | null {
  const label = l.label.trim();
  if (label.length === 0 || label.length > LINK_LABEL_MAX) return "label";
  const url = l.url.trim();
  return url.length > 0 && url.length <= URL_MAX && isHttpUrl(url) ? null : "url";
}
