import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { ShelfSection } from "@/components/public/ShelfBooks";
import { safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicMedia, getPublicSettings } from "@/data/publicSnapshot";
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
  const [books, { timezone }, media] = await Promise.all([getPublicShelf(), getPublicSettings(), getPublicMedia()]);
  const g = publicShelf(books);
  const year = buildYear(timezone);
  const yearCount = finishedInYear(g.finished, year);
  const empty = g.reading.length + g.finished.length + g.wishlist.length === 0;
  return (
    <PublicShell>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <header className="rounded-3xl border border-line bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_16%,var(--surface)),var(--surface))] p-5">
        <p aria-hidden="true" className="text-4xl">📚</p>
        <h1 className="mt-1 font-serif text-3xl font-bold">{bn.public.shelfTitle}</h1>
        <p className="mt-1 text-muted">{bn.public.shelfDesc}</p>
        {!empty && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {[
              [bn.public.shelfReading, g.reading.length],
              [bn.public.shelfFinished, g.finished.length],
              [bn.public.shelfWishlist, g.wishlist.length],
            ].map(([label, n]) => (
              <li key={label} className="rounded-full border border-line bg-surface px-3 py-1">
                {label}: <b>{(n as number).toLocaleString("bn-BD")}</b>
              </li>
            ))}
          </ul>
        )}
      </header>
      {empty ? (
        <p className="mt-6 text-muted">{bn.public.shelfEmpty}</p>
      ) : (
        <>
          {yearCount > 0 && <p className="mt-5 text-sm font-medium text-accent-text">🏆 {bn.public.shelfYear(yearCount.toLocaleString("bn-BD"), year.toLocaleString("bn-BD", { useGrouping: false }))}</p>}
          <ShelfSection icon="📖" title={bn.public.shelfReading} books={g.reading} media={media} />
          <ShelfSection icon="✅" title={bn.public.shelfFinished} books={g.finished} media={media} />
          <ShelfSection icon="🔖" title={bn.public.shelfWishlist} books={g.wishlist} media={media} />
        </>
      )}
    </PublicShell>
  );
}
