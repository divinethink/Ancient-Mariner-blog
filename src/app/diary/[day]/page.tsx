import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiaryCalendar } from "@/components/public/DiaryCalendar";
import { DiaryEntries, dayLabel } from "@/components/public/DiaryEntries";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import Link from "next/link";
import { adjacentDays, buildDiaryMonth, diaryDayPath } from "@/lib/diaryCalendar";
import { buildSeo } from "@/lib/seo";

export const dynamic = "force-static";
export const dynamicParams = false; // শুধু লেখা-আছে এমন দিন; বাকি 404

type Props = { params: Promise<{ day: string }> };

export async function generateStaticParams() {
  const { byDay } = await getPublicDiary();
  return [...byDay.keys()].map((day) => ({ day }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ day }, { siteTitle, allowIndexing }] = await Promise.all([params, getPublicSettings()]);
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined;
  }
  return buildSeo({ siteUrl, siteName: siteTitle, title: `${dayLabel(day)} — ${bn.public.calendarTitle}`, description: bn.public.diaryDesc, path: diaryDayPath(day), allowIndexing, type: "article", hasOgImage: hasDefaultOgImage() }) as Metadata;
}

/** `/diary/YYYY-MM-DD`: সেই মাসের পঞ্জিকা (দিনটি নির্বাচিত) + নিচে ওই দিনের পুরো দিনলিপি */
export default async function DiaryDay({ params }: Props) {
  const { day } = await params;
  const { tz, byDay, words } = await getPublicDiary();
  const entries = byDay.get(day);
  if (!entries) notFound();
  const adj = adjacentDays(byDay.keys(), day);
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{bn.public.calendarTitle}</h1>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <DiaryCalendar view={buildDiaryMonth(words, day.slice(0, 7))} selected={day} timeZone={tz} />
      </div>
      <DiaryEntries day={day} entries={entries} />
      <nav aria-label={bn.public.diaryNavLabel} className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-3">
        {adj.prev ? (
          <Link href={diaryDayPath(adj.prev)} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
            {bn.public.diaryPrev}
          </Link>
        ) : (
          <span />
        )}
        {adj.next && (
          <Link href={diaryDayPath(adj.next)} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
            {bn.public.diaryNext}
          </Link>
        )}
      </nav>
    </PublicShell>
  );
}
