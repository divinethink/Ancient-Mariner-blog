import Link from "next/link";
import { PostBody } from "@/components/public/PostBody";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { collectMediaIds, parseBody } from "@/lib/editorDoc";
import { resolveMediaMap } from "@/lib/gallery";
import type { CardMedia } from "@/lib/cards";
import { diaryDayPath, diaryPreview, type DiaryEntry } from "@/lib/diaryCalendar";
import { parseDiaryLook, type DiaryLook } from "@/lib/diaryLook";
import { DiaryPage } from "@/components/diary/DiaryPage";
import { diaryShareUrl } from "@/lib/diaryShare";
import { DiaryShare } from "./DiaryShare";

/** "YYYY-MM-DD" → "শনিবার · ১০ অক্টোবর, ২০২৬" (দিন-key থেকে সরাসরি UTC-তে; timezone-সরণ নেই) */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${bn.public.weekdaysFull[d.getUTCDay()]} · ${formatDate(d, "UTC")}`;
}

/** দিনের লেখা (পঞ্জিকার নিচে)। `preview` হলে প্রথম ~৩০ শব্দ (বাক্যের শেষে) + আরও পড়ুন; নইলে পুরোটা */
/** `look` দিলে প্রতিটি লেখা ডায়েরির পাতার চেহারায় (থিম/ফন্ট); না দিলে আগের কার্ড (সাইডবার-উইজেট) */
export function DiaryEntries({ day, entries, preview = false, media, look, siteUrl }: { day: string; entries: readonly DiaryEntry[]; preview?: boolean; media?: ReadonlyMap<string, CardMedia>; look?: DiaryLook; siteUrl?: string }) {
  const shareUrl = diaryShareUrl(siteUrl, day);
  return (
    <section aria-label={dayLabel(day)} className="mt-6">
      <h2 className={look ? "sr-only" : "font-serif text-xl font-bold"}>{dayLabel(day)}</h2>
      {entries.map((e) => {
        const auto = formatDate(new Date(`${day}T12:00:00Z`), "UTC");
        const custom = e.title.trim() !== "" && e.title !== auto;
        const p = preview ? diaryPreview(e.body) : { body: e.body, truncated: false };
        const readMore = p.truncated ? (
          <Link href={diaryDayPath(day)} prefetch={false} className="inline-flex min-h-11 items-center">
            {bn.public.readMore} →
          </Link>
        ) : undefined;
        // কার্ডের নিচে: বামে 'আরও পড়ুন', ডানে শেয়ার-আইকন (siteUrl না থাকলে আইকন নেই)
        const foot =
          readMore || shareUrl ? (
            <span className="flex w-full items-center justify-between gap-3">
              {readMore ?? <span />}
              {shareUrl && <DiaryShare url={shareUrl} title={custom ? e.title : dayLabel(day)} />}
            </span>
          ) : undefined;
        if (look) {
          return (
            <article key={e.id} className="mt-4">
              <DiaryPage day={day} title={custom ? e.title : undefined} location={e.location} look={e.theme ? parseDiaryLook({ theme: e.theme }, look) : look} footer={foot}>
                <div className="reading">
                  <PostBody body={p.body} media={resolveMediaMap(collectMediaIds(parseBody(p.body)), media)} />
                </div>
              </DiaryPage>
            </article>
          );
        }
        return (
          <article key={e.id} className="mt-4 rounded-2xl border border-line bg-surface p-4">
            {custom && <h3 className="font-serif text-lg font-bold">{e.title}</h3>}
            {e.location && <p className="text-sm text-muted">📍 {e.location}</p>}
            <div className="reading">
              <PostBody body={p.body} media={resolveMediaMap(collectMediaIds(parseBody(p.body)), media)} />
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
