import type { BookWithId } from "@/data/bookRepo";
import type { PublicMedia } from "@/data/mediaRepo";
import { bn } from "@/i18n/bn";
import { resolveCover } from "@/lib/cards";
import { Cover } from "./Cover";
import { dayLabel } from "./DiaryEntries";

// থিম-নিরাপদ: শুধু বিদ্যমান token (--accent/--today/--text/--surface) মিশিয়ে; নতুন রং-ধ্রুবক নেই
const SPINES = [
  "linear-gradient(160deg,var(--accent),color-mix(in srgb,var(--accent) 55%,var(--text)))",
  "linear-gradient(160deg,var(--today),color-mix(in srgb,var(--today) 55%,var(--text)))",
  "linear-gradient(160deg,color-mix(in srgb,var(--accent) 50%,var(--today)),color-mix(in srgb,var(--accent) 30%,var(--text)))",
  "linear-gradient(160deg,color-mix(in srgb,var(--text) 80%,var(--accent)),var(--text))",
];

/** শিরোনামের প্রথম অক্ষর (বাংলা যুক্তাক্ষর/স্বরচিহ্ন না ভেঙে grapheme ধরে) */
function initial(title: string): string {
  const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
  return [...seg.segment(title.trim())][0]?.segment ?? "ব";
}

/** পাবলিক বই-কার্ড (static): মলাট-স্টাইল spine, নাম, লেখক, তারিখ, নোট। শুধু পাবলিক বই এখানে আসে (`publicShelf`) */
function BookCard({ b, media }: { b: BookWithId; media: ReadonlyMap<string, PublicMedia> }) {
  const spine = SPINES[(b.title.codePointAt(0) ?? 0) % SPINES.length];
  const cover = resolveCover(b.coverMediaId, media); // পাবলিক ছবি না পেলে অক্ষর-মলাটই থাকে
  const dates = b.startDay || (b.status === "finished" && b.endDay);
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      {cover ? (
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md rounded-l-sm shadow-md">
          <Cover cover={{ ...cover, alt: cover.alt || b.title }} sizes="64px" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md rounded-l-sm font-serif text-3xl font-bold text-white shadow-md"
          style={{ background: spine, boxShadow: "inset 5px 0 0 rgba(255,255,255,.22), 0 2px 6px rgba(0,0,0,.18)" }}
        >
          {initial(b.title)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-bold leading-snug">{b.title}</p>
        {b.author && <p className="text-sm text-muted">{bn.public.shelfAuthor(b.author)}</p>}
        {dates && (
          <p className="mt-1 text-xs text-muted">
            {b.startDay && bn.public.shelfStarted(dayLabel(b.startDay))}
            {b.startDay && b.status === "finished" && b.endDay && " · "}
            {b.status === "finished" && b.endDay && bn.public.shelfEnded(dayLabel(b.endDay))}
          </p>
        )}
        {b.note && (
          <p className="mt-2 whitespace-pre-line border-l-2 border-accent pl-3 font-serif text-base">{b.note}</p>
        )}
      </div>
    </li>
  );
}

/** শিরোনাম, আইকন ও সংখ্যাসহ একটা অংশ (তাকের মতো); বই না থাকলে কিছুই আঁকে না */
export function ShelfSection({ title, icon, books, media }: { title: string; icon?: string; books: readonly BookWithId[]; media: ReadonlyMap<string, PublicMedia> }) {
  if (books.length === 0) return null;
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
        {icon && <span aria-hidden="true">{icon}</span>}
        {title}
        <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] px-2.5 py-0.5 font-sans text-sm font-semibold text-accent-text">
          {books.length.toLocaleString("bn-BD")}
        </span>
      </h2>
      {/* তাকের কাঠের রেখা */}
      <div aria-hidden="true" className="mt-2 h-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_35%,var(--line))]" />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {books.map((b) => (
          <BookCard key={b.id} b={b} media={media} />
        ))}
      </ul>
    </section>
  );
}
