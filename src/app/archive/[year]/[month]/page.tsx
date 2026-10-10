import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/config/env";
import { ListPage } from "@/components/public/ListPage";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { parseMonthParams } from "@/lib/archive";
import { buildSeo } from "@/lib/seo";

// build-সময়ে শুধু লেখা-থাকা মাসের পেজ; অন্য মাস = 404। `noindex,follow` ও sitemap-এ নেই (Arch §১৭ P10a)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ year: string; month: string }> };

async function find(year: string, month: string) {
  const mo = parseMonthParams(year, month);
  if (!mo) return undefined;
  return (await getPublicScopes()).find((s) => s.kind === "archive" && s.month?.y === mo.y && s.month.m === mo.m);
}

export async function generateStaticParams() {
  return (await getPublicScopes())
    .filter((s) => s.kind === "archive" && s.month)
    .map((s) => ({ year: String(s.month!.y), month: String(s.month!.m).padStart(2, "0") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, month } = await params;
  const [scope, settings] = await Promise.all([find(year, month), getPublicSettings()]);
  if (!scope) return {};
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return buildSeo({
    siteUrl,
    siteName: settings.siteTitle,
    title: `${scope.label} — ${settings.siteTitle}`,
    description: `${scope.label} — ${bn.public.postCount(scope.cards.length)}`,
    path: scope.path,
    allowIndexing: settings.allowIndexing,
    noindex: true,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function ArchivePage({ params }: Props) {
  const { year, month } = await params;
  const scope = await find(year, month);
  if (!scope) notFound();
  return <ListPage scope={scope} />;
}
