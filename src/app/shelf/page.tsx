import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { ShelfSection } from "@/components/public/ShelfBooks";
import { safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings } from "@/data/publicSnapshot";
import { buildYear, getPublicShelf } from "@/data/shelfSnapshot";
import { bn } from "@/i18n/bn";
import { finishedInYear, publicShelf, SHELF_PATH } from "@/lib/books";
import { buildSeo } from "@/lib/seo";

// build-সময়ে static; ডেটা `.build-data/shelf.json` (শুধু পাবলিক বই) থেকে। প্রাইভেট বই ও উদ্ধৃতি এখানে কখনো আসে না
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, allowIndexing } = await getPublicSettings();
  return buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${bn.public.shelfTitle} — ${siteTitle}`,
    description: bn.public.shelfDesc,
    path: SHELF_PATH,
    allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function ShelfPage() {
  const [books, { timezone }] = await Promise.all([getPublicShelf(), getPublicSettings()]);
  const g = publicShelf(books);
  const year = buildYear(timezone);
  const yearCount = finishedInYear(g.finished, year);
  const empty = g.reading.length + g.finished.length + g.wishlist.length === 0;
  return (
    <PublicShell>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <h1 className="font-serif text-3xl font-bold">{bn.public.shelfTitle}</h1>
      <p className="mt-1 text-muted">{bn.public.shelfDesc}</p>
      {empty ? (
        <p className="mt-6 text-muted">{bn.public.shelfEmpty}</p>
      ) : (
        <>
          {yearCount > 0 && <p className="mt-3 text-sm text-muted">{bn.public.shelfYear(yearCount.toLocaleString("bn-BD"), year.toLocaleString("bn-BD", { useGrouping: false }))}</p>}
          <ShelfSection title={bn.public.shelfReading} books={g.reading} />
          <ShelfSection title={bn.public.shelfFinished} books={g.finished} />
          <ShelfSection title={bn.public.shelfWishlist} books={g.wishlist} />
        </>
      )}
    </PublicShell>
  );
}
