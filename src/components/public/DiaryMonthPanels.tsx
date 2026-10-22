import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardMedia } from "@/lib/cards";
import { adjacentDays, diaryDayPath, type DiaryEntry } from "@/lib/diaryCalendar";
import { DiaryDaySwitch } from "./DiaryDaySwitch";
import { DiaryEntries } from "./DiaryEntries";

/**
 * মাসের সব দিনের লেখা একসাথে (শুধু `selected` দৃশ্যমান) — DiaryDaySwitch ট্যাপে দিন বদলায়, পাতা লোড ছাড়াই।
 * `previewDay` দিনটি সংক্ষিপ্ত প্রিভিউ + আরও পড়ুন (/diary হোম); বাকিগুলো পুরো লেখা + আগের/পরের দিন লিংক।
 * ছবি lazy — লুকানো অংশের ছবি নামে না।
 */
export function DiaryMonthPanels({
  ym,
  byDay,
  selected,
  previewDay,
  latestLabel,
  media,
}: {
  ym: string;
  byDay: ReadonlyMap<string, readonly DiaryEntry[]>;
  selected: string;
  previewDay?: string;
  latestLabel?: string;
  media?: ReadonlyMap<string, CardMedia>;
}) {
  const days = [...byDay.keys()].filter((d) => d.startsWith(ym)).sort();
  return (
    <div data-diary-panels="">
      <DiaryDaySwitch />
      {days.map((day) => {
        const preview = day === previewDay;
        const adj = adjacentDays(byDay.keys(), day);
        return (
          <div key={day} data-diary-panel={day} hidden={day !== selected}>
            {preview && latestLabel && <p className="mt-6 text-sm font-semibold text-muted">{latestLabel}</p>}
            <DiaryEntries day={day} entries={byDay.get(day) ?? []} preview={preview} media={media} />
            {!preview && (
              <nav aria-label={bn.public.diaryNavLabel} className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-3">
                {adj.prev ? (
                  <Link href={diaryDayPath(adj.prev)} prefetch={false} scroll={false} className="inline-flex min-h-11 items-center text-accent-text">
                    {bn.public.diaryPrev}
                  </Link>
                ) : (
                  <span />
                )}
                {adj.next && (
                  <Link href={diaryDayPath(adj.next)} prefetch={false} scroll={false} className="inline-flex min-h-11 items-center text-accent-text">
                    {bn.public.diaryNext}
                  </Link>
                )}
              </nav>
            )}
          </div>
        );
      })}
    </div>
  );
}
