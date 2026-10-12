import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardView } from "@/lib/cards";
import { PostCard } from "./PostCard";

const link = "block min-w-0 rounded-xl border border-line bg-surface px-3 py-2";

/** ← আগের | পরের → (build-ডেটার পাশের লেখা); সংশ্লিষ্ট দিকে লেখা না থাকলে সেই দিক লুকানো, দুটোই না থাকলে কিছুই না */
export function PostPager({ older, newer }: { older?: CardView; newer?: CardView }) {
  if (!older && !newer) return null;
  return (
    <nav aria-label={bn.public.postNavLabel} className="mt-8 grid grid-cols-2 gap-2">
      {older ? (
        <Link href={older.href} prefetch={false} rel="prev" className={link}>
          <span className="block text-xs text-muted">{bn.public.prevPost}</span>
          <span className="block truncate">{older.title || bn.library.untitled}</span>
        </Link>
      ) : (
        <span />
      )}
      {newer ? (
        <Link href={newer.href} prefetch={false} rel="next" className={`${link} text-end`}>
          <span className="block text-xs text-muted">{bn.public.nextPost}</span>
          <span className="block truncate">{newer.title || bn.library.untitled}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** সম্পর্কিত লেখা (একই ক্যাটাগরি, ≤২; ≥sm-এ পাশাপাশি সমান-প্রস্থ); না থাকলে সেকশনই নেই */
export function RelatedPosts({ cards }: { cards: readonly CardView[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="related-h">
      <h2 id="related-h" className="mb-3 font-serif text-xl font-bold">
        {bn.public.relatedTitle}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.id} className="min-w-0">
            <PostCard c={c} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
