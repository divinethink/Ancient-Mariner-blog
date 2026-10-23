import type { BookWithId } from "@/data/bookRepo";
import { bn } from "@/i18n/bn";
import { dayLabel } from "./DiaryEntries";

/** পাবলিক বই-কার্ড (static): নাম, লেখক, তারিখ, নোট। শুধু পাবলিক বই এখানে আসে (`publicShelf`) */
function BookCard({ b }: { b: BookWithId }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-serif text-lg font-bold">{b.title}</p>
      {b.author && <p className="text-sm text-muted">{bn.public.shelfAuthor(b.author)}</p>}
      {(b.startDay || (b.status === "finished" && b.endDay)) && (
        <p className="text-sm text-muted">
          {b.startDay && bn.public.shelfStarted(dayLabel(b.startDay))}
          {b.startDay && b.status === "finished" && b.endDay && " · "}
          {b.status === "finished" && b.endDay && bn.public.shelfEnded(dayLabel(b.endDay))}
        </p>
      )}
      {b.note && <p className="mt-2 whitespace-pre-line font-serif text-base">{b.note}</p>}
    </li>
  );
}

/** শিরোনামসহ একটা অংশ; বই না থাকলে কিছুই আঁকে না */
export function ShelfSection({ title, books }: { title: string; books: readonly BookWithId[] }) {
  if (books.length === 0) return null;
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {books.map((b) => (
          <BookCard key={b.id} b={b} />
        ))}
      </ul>
    </section>
  );
}
