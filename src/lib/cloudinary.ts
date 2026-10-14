// Cloudinary URL-নির্মাণ — pure (SDK/UI-মুক্ত; P6-১)। শুধু public (`upload`) ছবির delivery-URL; private ফাইলের signed URL privileged route-এ (P6-২)।
// কোটা-সাশ্রয় (Free tier-এ transformation গোনা হয়): প্রস্থ নির্দিষ্ট ধাপে snap হয় ⇒ সীমিত সংখ্যক derived ছবি।
export const CLD_WIDTHS = [320, 480, 640, 800, 1024, 1280, 1600, 2000] as const;
/** OG/সোশ্যাল-কার্ড (Arch §১৬: ১২০০×৬৩০) */
export const OG_SIZE = { w: 1200, h: 630 } as const;

const CLOUD_RE = /^[a-z0-9][a-z0-9_-]{1,59}$/i;
// public_id: সার্ভার নিজে বানায় (`blog/<id>`) — তাই ASCII-সীমিত; '..', শুরুর/শেষের '/' নিষিদ্ধ
const PUBLIC_ID_RE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/;

export const isValidCloudName = (s: unknown): s is string => typeof s === "string" && CLOUD_RE.test(s);
export const isValidPublicId = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 200 && PUBLIC_ID_RE.test(s) && !s.includes("..");

/** সবচেয়ে কাছের (উপরের) অনুমোদিত প্রস্থ; সর্বোচ্চের বেশি হলে সর্বোচ্চ */
export function snapWidth(w: number): number {
  const n = Number.isFinite(w) ? Math.max(1, Math.round(w)) : CLD_WIDTHS[0];
  return CLD_WIDTHS.find((x) => x >= n) ?? CLD_WIDTHS[CLD_WIDTHS.length - 1];
}

/** অবৈধ cloud/public_id হলে null — caller gradient fallback দেখাবে (ভাঙা URL কখনো নয়) */
export function cldUrl(cloud: string, publicId: string, o: { w?: number } = {}): string | null {
  if (!isValidCloudName(cloud) || !isValidPublicId(publicId)) return null;
  const t = ["f_auto", "q_auto", ...(o.w ? [`w_${snapWidth(o.w)}`, "c_limit"] : [])].join(",");
  return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${publicId}`;
}

/** favicon/apple-touch-icon — বর্গাকার PNG (স্বচ্ছ padding, লোগো কাটা পড়ে না); ছোট ফিক্সড আকার ⇒ ২টি derived ছবি */
export function cldIconUrl(cloud: string, publicId: string, size: number): string | null {
  if (!isValidCloudName(cloud) || !isValidPublicId(publicId)) return null;
  const n = Math.min(512, Math.max(16, Math.round(size)));
  return `https://res.cloudinary.com/${cloud}/image/upload/f_png,q_auto,c_pad,b_transparent,w_${n},h_${n}/${publicId}`;
}

/** responsive `srcset` (`<w>w` ধাপ); `max` পর্যন্ত — মূল ছবির প্রস্থ জানা থাকলে তার বেশি নয় */
export function cldSrcSet(cloud: string, publicId: string, max: number = CLD_WIDTHS[CLD_WIDTHS.length - 1]): string | null {
  if (!isValidCloudName(cloud) || !isValidPublicId(publicId)) return null;
  const cap = snapWidth(max);
  return CLD_WIDTHS.filter((w) => w <= cap)
    .map((w) => `${cldUrl(cloud, publicId, { w })} ${w}w`)
    .join(", ");
}

/** OG ছবি — ১২০০×৬৩০ fill-crop (মুখ/বিষয়ের দিকে `g_auto`) */
export function cldOgUrl(cloud: string, publicId: string): string | null {
  if (!isValidCloudName(cloud) || !isValidPublicId(publicId)) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,c_fill,g_auto,w_${OG_SIZE.w},h_${OG_SIZE.h}/${publicId}`;
}

/** সংরক্ষিত `cloudinaryUrl` থেকে cloud name (UI-তে thumbnail বানাতে; অন্য host হলে null) */
export function cloudFromUrl(url: string | undefined): string | null {
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\//.exec(url ?? "");
  return m && isValidCloudName(m[1]) ? m[1] : null;
}
