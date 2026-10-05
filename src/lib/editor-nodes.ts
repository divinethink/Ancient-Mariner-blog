// Editor-config, renderer ও test-এর একই উৎস (Arch §১৪.১): P2a-তে নির্ধারিত node/mark allowlist।
// P6 থেকে যোগ হবে: image (শুধু Cloudinary URL), youtube (শুধু video ID)। বাকি সব ব্লক।
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
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "underline", "link"] as const;

/** H1 = শিরোনাম (আলাদা ফিল্ড), তাই body-তে শুধু H2–H3 */
export const HEADING_LEVELS = [2, 3] as const;

/** লিংক শুধু http/https/mailto (Arch §১৪.১) */
export function isSafeHref(url: string): boolean {
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(url.trim());
}
