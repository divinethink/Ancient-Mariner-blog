import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiarySummary } from "@/components/public/DiarySummary";
import { DiaryStats, DiaryYear } from "@/components/public/DiaryYear";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { buildYearView, diaryYearPath, diaryYears, streakStats } from "@/lib/diaryCalendar";
import { PLACES_PATH, placeStats, summarizeYear } from "@/lib/diarySummary";
import { widgetTitle } from "@/lib/layout";
import { buildSeo } from "@/lib/seo";

export const dynamic = "force-static";
export const dynamicParams = false; // শুধু লেখা-আছে এমন বছর

type Props = { params: Promise<{ year: string }> };

export async function generateStaticParams() {
  const { byDay } = await getPublicDiary();
  return diaryYears(byDay.keys()).map((y) => ({ year: String(y) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ year }, { siteTitle, allowIndexing }] = await Promise.all([params, getPublicSettings()]);
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined;
  }
  return buildSeo({ siteUrl, siteName: siteTitle, title: `${year} — ${bn.public.calendarTitle}`, description: bn.public.diaryDesc, path: diaryYearPath(Number(year)), allowIndexing, type: "website", hasOgImage: hasDefaultOgImage() }) as Metadata;
}

/** `/diary/year/2026`: সেই বছরের হিটম্যাপ ও সব-বছরের ব্যাজ */
export default async function DiaryYearPage({ params }: Props) {
  const year = Number((await params).year);
  const { tz, byDay, words } = await getPublicDiary();
  const settings = await getPublicSettings();
  const calTitle = widgetTitle(settings.layout.sidebar, "calendar", bn.public.calendarTitle);
  const years = diaryYears(byDay.keys());
  if (!years.includes(year)) notFound();
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{calTitle}</h1>
      <DiaryStats s={streakStats(byDay.keys())} showStreak={settings.showDiaryStreak === true} />
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <DiaryYear view={buildYearView(words, year)} years={years} timeZone={tz} />
      </div>
      <DiarySummary s={summarizeYear(byDay, year)} />
      {placeStats(byDay).length > 0 && (
        <p className="mt-4">
          <Link href={PLACES_PATH} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text underline">
            {bn.public.diaryPlacesLink}
          </Link>
        </p>
      )}
    </PublicShell>
  );
}
