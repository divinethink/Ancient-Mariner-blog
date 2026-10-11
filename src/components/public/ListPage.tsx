import Link from "next/link";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { splitCards } from "@/lib/cards";
import type { Scope } from "@/lib/publicLists";
import { LoadMore } from "./LoadMore";
import { PostCardList } from "./PostCard";
import { PublicShell } from "./PublicShell";

const KIND_LABEL = { blog: "", category: bn.public.kindCategory, tag: bn.public.kindTag, series: bn.public.kindSeries, archive: bn.public.kindArchive } as const;

/** /blog, category/tag/series-এর সাধারণ পেজ: breadcrumb + নাম/বিবরণ + card-তালিকা + [আরও দেখান] */
export async function ListPage({ scope }: { scope: Scope }) {
  const { postsPerPage } = await getPublicSettings();
  const { first, chunks } = splitCards(scope.cards, postsPerPage, scope.key);
  const title = scope.term?.name ?? scope.label ?? bn.public.blog;
  const crumbs = [
    { label: bn.public.home, href: "/" },
    ...(scope.kind !== "blog" ? [{ label: bn.public.blog, href: "/blog" }] : []),
    ...(scope.parent ? [{ label: scope.parent.name, href: undefined as string | undefined }] : []),
  ];
  return (
    <PublicShell sidebar>
      <nav aria-label={bn.public.breadcrumbLabel} className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-x-2">
          {crumbs.map((c) => (
            <li key={c.label} className="flex items-center gap-x-2">
              {c.href ? (
                <Link href={c.href} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
              <span aria-hidden="true">›</span>
            </li>
          ))}
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <h1 className="mt-1 font-serif text-3xl font-bold">
        {KIND_LABEL[scope.kind] && <span className="block text-base font-normal text-muted">{KIND_LABEL[scope.kind]}</span>}
        {title}
      </h1>
      {scope.term?.description && <p className="mt-2 text-muted">{scope.term.description}</p>}
      <p className="mt-1 text-sm text-muted">{bn.public.postCount(scope.cards.length)}</p>
      <div className="mt-6">
        {first.length === 0 ? <p className="text-muted">{bn.public.empty}</p> : <PostCardList cards={first} />}
        {chunks.length > 0 && <LoadMore scopeKey={scope.key} chunks={chunks.length} />}
      </div>
    </PublicShell>
  );
}
