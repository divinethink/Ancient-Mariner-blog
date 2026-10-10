// পাবলিক gallery-র pure অংশ (SDK/UI-মুক্ত; P8a-২): build-এ লাগা media-id সংগ্রহ, id → render-তথ্য, picker-এর তালিকা-গণিত।
import { resolveCover, type CardMedia, type CoverView } from "./cards";
/** postRepo.MAX_GALLERY-র সমান (data → lib দিক বজায় রাখতে আলাদা ধ্রুবক) */
export const MAX_GALLERY_ITEMS = 20;

type WithMedia = { coverMediaId?: string; gallery?: readonly string[] };

/** published লেখাগুলোর cover + gallery media-id (ডুপ্লিকেট ছাড়া, ক্রম বজায়) */
export function mediaIdsOf(posts: readonly WithMedia[]): string[] {
  const out = new Set<string>();
  for (const p of posts) {
    if (p.coverMediaId) out.add(p.coverMediaId);
    for (const id of p.gallery ?? []) out.add(id);
  }
  return [...out];
}

/** gallery-id → ছবি-তালিকা (লেখকের ক্রমে); public মেটা না থাকা/অবৈধ URL বাদ — build থামে না */
export function resolveGallery(ids: readonly string[] | undefined, media: ReadonlyMap<string, CardMedia> | undefined): CoverView[] {
  return (ids ?? []).slice(0, MAX_GALLERY_ITEMS).flatMap((id) => {
    const v = resolveCover(id, media);
    return v ? [v] : [];
  });
}

export const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** picker: নেই ⇒ শেষে যোগ (সীমা পর্যন্ত), আছে ⇒ সরানো */
export function toggleId(list: readonly string[], id: string, max = MAX_GALLERY_ITEMS): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= max ? [...list] : [...list, id];
}

/** ক্রম বদল: i-তম আইটেম d (±1) ঘর সরে; সীমার বাইরে হলে অপরিবর্তিত */
export function moveId(list: readonly string[], i: number, d: -1 | 1): string[] {
  const j = i + d;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
