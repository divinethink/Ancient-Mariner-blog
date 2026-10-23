// পড়ার তাক (দিনলিপি-ঘ): pure (SDK/UI-মুক্ত)। বই = পড়ব/পড়ছি/শেষ; তারিখ শুধু দিন-key ("YYYY-MM-DD", সাইট-timezone — Dev Rule ১৫)।
export const BOOK_TITLE_MAX = 150;
export const BOOK_AUTHOR_MAX = 100;
export const BOOK_NOTE_MAX = 2000;
export const BOOK_LIST_MAX = 500;
export const QUOTE_MAX = 500;
export const QUOTE_PAGE_MAX = 20;
export const QUOTE_LIST_MAX = 200;

export type BookStatusValue = "wishlist" | "reading" | "finished";

export const isDayKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** যে বছরে শেষ হওয়া বইয়ের সংখ্যা (`endDay` না থাকলে গোনা হয় না) */
export function finishedInYear(books: readonly { status: string; endDay?: string | undefined }[], year: number): number {
  return books.filter((b) => b.status === "finished" && b.endDay !== undefined && Number(b.endDay.slice(0, 4)) === year).length;
}

/** অবস্থা-অনুযায়ী সংখ্যা (বাছাই-chip-এর জন্য) */
export function countByStatus(books: readonly { status: string }[]): Record<BookStatusValue, number> {
  const out: Record<BookStatusValue, number> = { wishlist: 0, reading: 0, finished: 0 };
  for (const b of books) if (b.status === "wishlist" || b.status === "reading" || b.status === "finished") out[b.status] += 1;
  return out;
}

/** শেষ-করা বই নতুন আগে (`endDay` desc; না থাকলে শেষে); বাকিগুলো যেভাবে এসেছে (updatedAt desc) */
export function sortFinished<T extends { endDay?: string | undefined }>(books: readonly T[]): T[] {
  return [...books].sort((a, b) => (b.endDay ?? "").localeCompare(a.endDay ?? ""));
}

export const SHELF_PATH = "/shelf";

/** পাবলিক তাক: শুধু `visibility==='public'` (query ও rules-এর পরও আরেক স্তর); পড়ছি/পড়ব সাম্প্রতিক আগে, শেষ-করা `endDay` নতুন আগে */
export function publicShelf<T extends { status: string; visibility: string; endDay?: string | undefined; updatedAt: Date }>(
  books: readonly T[],
): { reading: T[]; finished: T[]; wishlist: T[] } {
  const pub = books.filter((b) => b.visibility === "public");
  const recent = (a: T, b: T) => b.updatedAt.getTime() - a.updatedAt.getTime();
  return {
    reading: pub.filter((b) => b.status === "reading").sort(recent),
    wishlist: pub.filter((b) => b.status === "wishlist").sort(recent),
    finished: pub.filter((b) => b.status === "finished").sort((a, b) => (b.endDay ?? "").localeCompare(a.endDay ?? "") || recent(a, b)),
  };
}
