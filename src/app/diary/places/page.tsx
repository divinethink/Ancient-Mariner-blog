import type { Metadata } from "next";
import { PlaceList } from "@/components/public/DiarySummary";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { PLACES_PATH, placeStats } from "@/lib/diarySummary";
import { buildSeo } from "@/lib/seo";

// build-সময়ে prerender; শুধু প্রকাশিত+public দিনলিপির স্থান (`/diary/[day]`-এর static রুটের আগে মেলে)
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, allowIndexing } = await getPublicSettings();
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined;
  }
  return buildSeo({ siteUrl, siteName: siteTitle, title: bn.public.diaryPlacesTitle, description: bn.public.diaryPlacesDesc, path: PLACES_PATH, allowIndexing, type: "website", hasOgImage: hasDefaultOgImage() }) as Metadata;
}

/** `/diary/places`: দিনলিপিতে লেখা স্থানের তালিকা (বেশি আগে), প্রতিটির তারিখ-লিংকসহ। ম্যাপ নেই */
export default async function DiaryPlaces() {
  const { byDay } = await getPublicDiary();
  const places = placeStats(byDay);
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{bn.public.diaryPlacesTitle}</h1>
      <p className="mt-1 text-muted">{bn.public.diaryPlacesDesc}</p>
      {places.length > 0 ? <PlaceList places={places} /> : <p className="mt-4 text-muted">{bn.public.diaryPlacesEmpty}</p>}
    </PublicShell>
  );
}
