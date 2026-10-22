import type { Metadata } from "next";
import Link from "next/link";
import { DiaryCalendar } from "@/components/public/DiaryCalendar";
import { DiaryMonthPanels } from "@/components/public/DiaryMonthPanels";
import { DiaryStats, DiaryYear } from "@/components/public/DiaryYear";
import { OnThisDay } from "@/components/public/OnThisDay";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicMedia, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { PLACES_PATH, placeStats } from "@/lib/diarySummary";
import { buildDiaryMonth, buildYearView, DIARY_FEED_PATH, DIARY_PATH, diaryYears, latestDay, streakStats } from "@/lib/diaryCalendar";
import { widgetTitle } from "@/lib/layout";
import { buildSeo } from "@/lib/seo";

// build-সময়ে prerender; পাঠক-রিকোয়েস্টে Worker চলে না
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, allowIndexing, layout } = await getPublicSettings();
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return buildSeo({ siteUrl, siteName: siteTitle, title: widgetTitle(layout.sidebar, "calendar", bn.public.calendarTitle), description: bn.public.diaryDesc, path: DIARY_PATH, allowIndexing, type: "website", hasOgImage: hasDefaultOgImage() }) as Metadata;
}

/** `/diary`: পঞ্জিকা (সর্বশেষ লেখার মাস) + নিচে সর্বশেষ দিনলিপির প্রথম ~৩০ শব্দ ও আরও পড়ুন */
export default async function DiaryHome() {
  const { tz, byDay, words } = await getPublicDiary();
  const settings = await getPublicSettings();
  const calTitle = widgetTitle(settings.layout.sidebar, "calendar", bn.public.calendarTitle);
  const last = latestDay(byDay.keys());
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{calTitle}</h1>
      {last ? (
        <>
          <p className="mt-1 text-muted">{bn.public.diaryDesc}</p>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <DiaryCalendar view={buildDiaryMonth(words, last.slice(0, 7))} selected={last} timeZone={tz} />
          </div>
          <DiaryStats s={streakStats(byDay.keys())} showStreak={settings.showDiaryStreak === true} />
          <OnThisDay days={[...byDay.keys()]} timeZone={tz} />
          <DiaryMonthPanels ym={last.slice(0, 7)} byDay={byDay} selected={last} previewDay={last} latestLabel={bn.public.diaryLatest} media={await getPublicMedia()} />
          <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
            <DiaryYear view={buildYearView(words, Number(last.slice(0, 4)))} years={diaryYears(byDay.keys())} timeZone={tz} />
          </div>
          {placeStats(byDay).length > 0 && (
            <p className="mt-4">
              <Link href={PLACES_PATH} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text underline">
                {bn.public.diaryPlacesLink}
              </Link>
            </p>
          )}
          <p className="mt-4">
            <a href={DIARY_FEED_PATH} className="inline-flex min-h-11 items-center text-accent-text underline">
              {bn.public.diaryFeed}
            </a>
          </p>
        </>
      ) : (
        <p className="mt-4 text-muted">{bn.public.diaryEmpty}</p>
      )}
    </PublicShell>
  );
}
