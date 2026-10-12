import Link from "next/link";
import { Cover } from "@/components/public/Cover";
import { bn } from "@/i18n/bn";
import type { CardLink, CardView } from "@/lib/cards";

/** ক্যাটাগরি: শিরোনামের উপরে ছোট accent লেখা (featured-এর লেবেলের মতো); আগের নিচের chip-এর জায়গা বাঁচে */
function CategoryLabel({ l }: { l: CardLink }) {
  const cls = "-mt-2 inline-flex min-h-10 items-center text-sm font-semibold";
  return l.href ? (
    <Link href={l.href} prefetch={false} className={`${cls} text-accent-text`}>
      {l.name}
    </Link>
  ) : (
    <span className={`${cls} text-muted`}>{l.name}</span>
  );
}

/** পাবলিক post-card (server ও client দুই জায়গায় — hook নেই); `body` কখনো না (CardView-তে নেই) */
export function PostCard({ c, compact = false }: { c: CardView; compact?: boolean }) {
  // compact (সম্পর্কিত লেখা): লম্বালম্বি, শুধু শিরোনাম · তারিখ · সারাংশ — cover/দিন-বক্স/chip ছাড়া
  if (compact)
    return (
      <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-serif text-lg font-bold leading-snug">
          <Link href={c.href} prefetch={false} className="inline-flex min-h-11 items-center">
            {c.title || bn.library.untitled}
          </Link>
        </h3>
        {c.dateISO && (
          <p className="mt-1 text-sm text-muted">
            <time dateTime={c.dateISO}>{c.dateLabel}</time>
          </p>
        )}
        {c.excerpt && <p className="mt-2 line-clamp-3 text-muted">{c.excerpt}</p>}
      </article>
    );
  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
      {c.cover && (
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-line sm:h-36 sm:w-52">
          <Cover cover={c.cover} sizes="(min-width: 640px) 208px, 112px" />
          {c.day && (
            <span aria-hidden="true" className="absolute left-2 top-2 flex flex-col items-center rounded-lg bg-surface px-2 py-1 text-center text-xs leading-tight shadow">
              <b className="font-serif text-base text-accent-text">{c.day}</b>
              {c.month}
            </span>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {c.category && <CategoryLabel l={c.category} />}
        <h3 className="font-serif text-xl font-bold leading-snug">
          <Link href={c.href} prefetch={false} className="inline-flex min-h-11 items-center">
            {c.title || bn.library.untitled}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {c.dateISO && <time dateTime={c.dateISO}>{c.dateLabel}</time>}
          {c.minutes > 0 && ` · ${bn.public.readMinutes(c.minutes)}`}
        </p>
        {c.excerpt && <p className="mt-2 line-clamp-2 text-muted">{c.excerpt}</p>}
      </div>
    </article>
  );
}

export function PostCardList({ cards }: { cards: readonly CardView[] }) {
  return (
    <ul className="space-y-4">
      {cards.map((c) => (
        <li key={c.id}>
          <PostCard c={c} />
        </li>
      ))}
    </ul>
  );
}
