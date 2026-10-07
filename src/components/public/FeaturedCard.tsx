import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardView } from "@/lib/cards";

/** Home-এর featured বড় কার্ড (cover ছাড়া — P6-র আগে; ছবি এলে cover এখানে বসবে) */
export function FeaturedCard({ c }: { c: CardView }) {
  return (
    <article className="rounded-3xl border border-line bg-surface p-6">
      <p className="text-sm font-semibold text-accent-text">{bn.public.featuredLabel}</p>
      <h2 className="mt-1 font-serif text-2xl font-bold leading-snug">
        <Link href={c.href} prefetch={false} className="inline-flex min-h-11 items-center">
          {c.title || bn.library.untitled}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-muted">
        {c.dateISO && <time dateTime={c.dateISO}>{c.dateLabel}</time>}
        {c.category && ` · ${c.category.name}`}
        {c.minutes > 0 && ` · ${bn.public.readMinutes(c.minutes)}`}
      </p>
      {c.excerpt && <p className="mt-3 text-muted">{c.excerpt}</p>}
      <Link href={c.href} prefetch={false} className="mt-3 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.public.readMore} →
      </Link>
    </article>
  );
}
