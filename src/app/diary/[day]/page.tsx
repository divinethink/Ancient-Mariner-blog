import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiaryCalendar } from "@/components/public/DiaryCalendar";
import { dayLabel } from "@/components/public/DiaryEntries";
import { DiaryMonthPanels } from "@/components/public/DiaryMonthPanels";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicMedia, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { buildDiaryMonth, diaryDayPath } from "@/lib/diaryCalendar";
import { widgetTitle } from "@/lib/layout";
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
  const calTitle = widgetTitle((await getPublicSettings()).layout.sidebar, "calendar", bn.public.calendarTitle);
  const entries = byDay.get(day);
  if (!entries) notFound();
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{calTitle}</h1>
      <p className="mt-1 text-muted">{bn.public.diaryDesc}</p>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <DiaryCalendar view={buildDiaryMonth(words, day.slice(0, 7))} selected={day} timeZone={tz} />
      </div>
      <DiaryMonthPanels ym={day.slice(0, 7)} byDay={byDay} selected={day} media={await getPublicMedia()} />
    </PublicShell>
  );
}
