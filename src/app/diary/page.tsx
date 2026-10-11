import type { Metadata } from "next";
import { DiaryCalendar } from "@/components/public/DiaryCalendar";
import { DiaryEntries } from "@/components/public/DiaryEntries";
import { DiaryStats, DiaryYear } from "@/components/public/DiaryYear";
import { OnThisDay } from "@/components/public/OnThisDay";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { buildDiaryMonth, buildYearView, DIARY_FEED_PATH, DIARY_PATH, diaryYears, latestDay, streakStats } from "@/lib/diaryCalendar";
import { buildSeo } from "@/lib/seo";

// build-সময়ে prerender; পাঠক-রিকোয়েস্টে Worker চলে না
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, allowIndexing } = await getPublicSettings();
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return buildSeo({ siteUrl, siteName: siteTitle, title: bn.public.calendarTitle, description: bn.public.diaryDesc, path: DIARY_PATH, allowIndexing, type: "website", hasOgImage: hasDefaultOgImage() }) as Metadata;
}

/** `/diary`: পঞ্জিকা (সর্বশেষ লেখার মাস) + নিচে সর্বশেষ দিনলিপির প্রথম ৫০ লাইন ও আরও পড়ুন */
export default async function DiaryHome() {
  const { tz, byDay, words } = await getPublicDiary();
  const last = latestDay(byDay.keys());
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{bn.public.calendarTitle}</h1>
      {last ? (
        <>
          <p className="mt-1 text-muted">{bn.public.diaryDesc}</p>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <DiaryCalendar view={buildDiaryMonth(words, last.slice(0, 7))} selected={last} timeZone={tz} />
          </div>
          <DiaryStats s={streakStats(byDay.keys())} />
          <OnThisDay days={[...byDay.keys()]} timeZone={tz} />
          <p className="mt-6 text-sm font-semibold text-muted">{bn.public.diaryLatest}</p>
          <DiaryEntries day={last} entries={byDay.get(last) ?? []} preview />
          <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
            <DiaryYear view={buildYearView(words, Number(last.slice(0, 4)))} years={diaryYears(byDay.keys())} timeZone={tz} />
          </div>
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
