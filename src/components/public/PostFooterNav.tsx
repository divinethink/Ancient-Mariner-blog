import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardView } from "@/lib/cards";
import { PostCardList } from "./PostCard";

const link = "inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface px-4 py-2";

/** ← আগের | পরের → (build-ডেটার পাশের লেখা); সংশ্লিষ্ট দিকে লেখা না থাকলে সেই দিক লুকানো, দুটোই না থাকলে কিছুই না */
export function PostPager({ older, newer }: { older?: CardView; newer?: CardView }) {
  if (!older && !newer) return null;
  return (
    <nav aria-label={bn.public.postNavLabel} className="mt-8 flex flex-col gap-3 min-[560px]:flex-row min-[560px]:justify-between">
      {older ? (
        <Link href={older.href} prefetch={false} rel="prev" className={link}>
          <span>
            <span className="block text-xs text-muted">{bn.public.prevPost}</span>
            {older.title || bn.library.untitled}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {newer && (
        <Link href={newer.href} prefetch={false} rel="next" className={`${link} min-[560px]:text-end`}>
          <span>
            <span className="block text-xs text-muted">{bn.public.nextPost}</span>
            {newer.title || bn.library.untitled}
          </span>
        </Link>
      )}
    </nav>
  );
}

/** সম্পর্কিত লেখা (একই ক্যাটাগরি, ≤৩); না থাকলে সেকশনই নেই */
export function RelatedPosts({ cards }: { cards: readonly CardView[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="related-h">
      <h2 id="related-h" className="mb-3 font-serif text-xl font-bold">
        {bn.public.relatedTitle}
      </h2>
      <PostCardList cards={cards} />
    </section>
  );
}
