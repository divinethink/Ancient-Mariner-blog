import Link from "next/link";
import { PostBody } from "@/components/public/PostBody";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { diaryDayPath, diaryPreview, type DiaryEntry } from "@/lib/diaryCalendar";

/** "YYYY-MM-DD" → "শনিবার · ১০ অক্টোবর, ২০২৬" (দিন-key থেকে সরাসরি UTC-তে; timezone-সরণ নেই) */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${bn.public.weekdaysFull[d.getUTCDay()]} · ${formatDate(d, "UTC")}`;
}

/** দিনের লেখা (পঞ্জিকার নিচে)। `preview` হলে প্রথম ৫০ লাইন + আরও পড়ুন; নইলে পুরোটা */
export function DiaryEntries({ day, entries, preview = false }: { day: string; entries: readonly DiaryEntry[]; preview?: boolean }) {
  return (
    <section aria-label={dayLabel(day)} className="mt-6">
      <h2 className="font-serif text-xl font-bold">{dayLabel(day)}</h2>
      {entries.map((e) => {
        const p = preview ? diaryPreview(e.body) : { body: e.body, truncated: false };
        return (
          <article key={e.id} className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <div className="reading">
              <PostBody body={p.body} />
            </div>
            {p.truncated && (
              <Link href={diaryDayPath(day)} prefetch={false} className="mt-3 inline-flex min-h-11 items-center text-accent-text underline">
                {bn.public.readMore} →
              </Link>
            )}
          </article>
        );
      })}
    </section>
  );
}
