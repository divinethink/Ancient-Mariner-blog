// Firestore auto-ID-র মতো ২০ অক্ষরের ID (a-zA-Z0-9); editor নতুন লেখায় আগেই বানায় যাতে create retry-নিরাপদ হয় (postRepo.create)।
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function newId(length = 20): string {
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < 248) out.push(ALPHABET[buf[0] % 62]); // 248 = 62×4 — modulo-bias এড়াতে বাকি বাদ
  }
  return out.join("");
}

/** URL থেকে আসা postId যাচাই (IndexedDB key/Firestore doc-ID-তে অদ্ভুত অক্ষর নয়) */
export const isValidPostId = (id: string): boolean => /^[A-Za-z0-9]{1,40}$/.test(id);
