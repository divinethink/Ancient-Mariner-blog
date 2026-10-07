// পাবলিক তালিকার পেজ ও [আরও দেখান] chunk (Arch §২ 'Public payload'): pure, SDK/UI-মুক্ত।
export type Page<T> = { items: T[]; page: number; pages: number };

/** `pageSize` ≥ ১ ধরা হয়; খালি তালিকাতেও ১টা (খালি) পেজ — রুট সবসময় তৈরি হয় */
export function pageCount(total: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize));
  return Math.max(1, Math.ceil(total / size));
}

/** ১-ভিত্তিক পেজ; সীমার বাইরে হলে clamp */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = pageCount(items.length, size);
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}
