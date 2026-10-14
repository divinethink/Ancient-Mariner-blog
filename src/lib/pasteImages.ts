// অন্য ওয়েব/ব্লগ থেকে কপি-করা HTML-এর `<img>` চিহ্নিত করা — pure (DOM/SDK-মুক্ত)।
// প্রতিটি ছবির জায়গায় অস্থায়ী টেক্সট-চিহ্ন (token) বসে; এডিটর আপলোড শেষে চিহ্নটিকে `mediaImage` দিয়ে বদলায়।
export const PASTE_IMG_MAX = 20; // এক পেস্টে সর্বোচ্চ ছবি (বেশি হলে বাকিগুলো বাদ)
// আসল ছবির ঠিকানা কোথায় থাকে: ওয়ার্ডপ্রেস/lazy-load এর data-* আগে, তারপর src
const SRC_ATTRS = ["data-orig-file", "data-src", "data-lazy-src", "src"] as const;

export type PasteImport = { html: string; urls: string[]; alts: string[]; tag: string };

export const pasteToken = (tag: string, i: number): string => `⟦img-${tag}-${i}⟧`;

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
};
const unescapeAttr = (s: string): string => s.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'").trim();

/** শুধু http/https (ইউজার/পাসওয়ার্ড ছাড়া, ≤২০০০ অক্ষর); `//host/…` ⇒ https। data:/blob:/অন্য সব ⇒ null */
export function safeImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  let u = unescapeAttr(raw);
  if (u.startsWith("//")) u = `https:${u}`;
  if (u.length === 0 || u.length > 2000) return null;
  try {
    const p = new URL(u);
    if ((p.protocol !== "http:" && p.protocol !== "https:") || p.username || p.password) return null;
    return p.toString();
  } catch {
    return null;
  }
}

/** ইমোজি (ওয়ার্ডপ্রেসের s.w.org) ও ১-২px ট্র্যাকিং-পিক্সেল — ছবি নয়, বাদ */
function isDecorative(img: string): boolean {
  if (/\bclass\s*=\s*["'][^"']*\bemoji\b/i.test(img)) return true;
  const small = (v: string | null) => v !== null && /^\d+$/.test(v.trim()) && Number(v) <= 2;
  return small(attr(img, "width")) || small(attr(img, "height"));
}

/** ছবি ছাড়া হলে `urls` খালি (html প্রায় অপরিবর্তিত)। একই ঠিকানা একবারই তালিকায়; চিহ্ন একাধিক জায়গায় থাকতে পারে */
export function prepareImport(html: string, tag: string): PasteImport {
  const urls: string[] = [];
  const alts: string[] = [];
  const out = html.replace(/<img\b[^>]*>/gi, (img) => {
    if (isDecorative(img)) return "";
    let url: string | null = null;
    for (const n of SRC_ATTRS) {
      url = safeImageUrl(attr(img, n));
      if (url) break;
    }
    if (!url) return "";
    let i = urls.indexOf(url);
    if (i < 0) {
      if (urls.length >= PASTE_IMG_MAX) return "";
      urls.push(url);
      alts.push(unescapeAttr(attr(img, "alt") ?? ""));
      i = urls.length - 1;
    }
    return `<span>${pasteToken(tag, i)}</span>`;
  });
  return { html: out, urls, alts, tag };
}
