// Editor-config, renderer ও test-এর একই উৎস (Arch §১৪.১): P2a-তে নির্ধারিত node/mark allowlist।
// P6-ছ: mediaImage (শুধু mediaId — raw URL কখনো নয়)। পরে যোগ হবে: youtube (শুধু video ID)। বাকি সব ব্লক।
export const ALLOWED_NODES = [
  "doc",
  "text",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "mediaImage",
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "underline", "link"] as const;

/** H1 = শিরোনাম (আলাদা ফিল্ড), তাই body-তে শুধু H2–H3 */
export const HEADING_LEVELS = [2, 3] as const;

/** লিংক শুধু http/https/mailto (Arch §১৪.১) */
export function isSafeHref(url: string): boolean {
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(url.trim());
}

/** mediaImage-র mediaId: Firestore auto-id ধাঁচ (ASCII, '/' নেই) — URL/path ঢোকার পথ বন্ধ */
export const isSafeMediaId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/** mediaImage-র alt / caption-এর সর্বোচ্চ দৈর্ঘ্য (অক্ষর) */
export const MEDIA_ALT_MAX = 300;
export const MEDIA_CAPTION_MAX = 300;

/** mediaImage-র মাপ ও অবস্থান (শুধু এই তালিকার মান; বাইরের মান বাদ)। attr না থাকা = পুরনো আচরণ (পুরো-প্রস্থ), তাই পুরনো লেখা অক্ষত */
export const IMAGE_SIZES = ["s", "m", "l", "full"] as const;
export const IMAGE_ALIGNS = ["left", "center", "right"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageAlign = (typeof IMAGE_ALIGNS)[number];
export const isImageSize = (v: unknown): v is ImageSize => typeof v === "string" && (IMAGE_SIZES as readonly string[]).includes(v);
export const isImageAlign = (v: unknown): v is ImageAlign => typeof v === "string" && (IMAGE_ALIGNS as readonly string[]).includes(v);
/** নতুন বসানো ছবির শুরুর মান */
export const NEW_IMAGE_LAYOUT = { size: "m", align: "center" } as const;
