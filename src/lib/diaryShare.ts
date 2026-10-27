// দিনলিপি শেয়ার-লিংক (pure): ফেসবুক + হোয়াটসঅ্যাপ। শুধু http(s) পূর্ণ URL; নইলে null (বোতাম দেখানো হয় না)।
import { diaryDayPath } from "./diaryCalendar";
import { absoluteUrl, facebookShareUrl } from "./reader";

/** siteUrl + `/diary/YYYY-MM-DD`; siteUrl না থাকলে (লোকাল dev) undefined */
export const diaryShareUrl = (siteUrl: string | undefined, day: string): string | undefined => absoluteUrl(siteUrl, diaryDayPath(day));

export function whatsappShareUrl(pageUrl: string | undefined, text: string): string | null {
  if (!pageUrl) return null;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `https://wa.me/?text=${encodeURIComponent(`${text} ${u.href}`.trim())}`;
  } catch {
    return null;
  }
}

export const shareLinks = (pageUrl: string | undefined, text: string): { facebook: string | null; whatsapp: string | null } => ({
  facebook: facebookShareUrl(pageUrl),
  whatsapp: whatsappShareUrl(pageUrl, text),
});
