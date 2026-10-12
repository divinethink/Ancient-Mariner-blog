import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/public/PostBody";
import { PublicShell } from "@/components/public/PublicShell";
import { ReadingChrome } from "@/components/public/ReadingChrome";
import { ReaderBar } from "@/components/public/ReaderTools";
import { findChapter, safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings } from "@/data/publicSnapshot";
import { getPublicWorks } from "@/data/worksSnapshot";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { worksPath } from "@/lib/projects";
import { readingMinutes } from "@/lib/readingTime";
import { buildSeo } from "@/lib/seo";
import { chapterExcerpt, chapterNeighbors } from "@/lib/works";

// build-সময়ে শুধু published+public অধ্যায় (প্রজেক্টও published+public); অন্য slug = 404। `body` শুধু এই পেজে (P14c-১)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ project: string; chapter: string }> };

export async function generateStaticParams() {
  return (await getPublicWorks()).flatMap((w) => w.chapters.map((c) => ({ project: w.project.slug, chapter: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const [hit, { siteTitle, allowIndexing }] = await Promise.all([findChapter(p.project, p.chapter), getPublicSettings()]);
  if (!hit) return {};
  const { work, chapter } = hit;
  return buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${chapter.title} — ${work.project.title} — ${siteTitle}`,
    description: chapterExcerpt(chapter.body),
    path: worksPath(work.project.slug, chapter.slug),
    allowIndexing,
    type: "article",
    publishedTime: chapter.publishedAt,
    modifiedTime: chapter.updatedAt,
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

const navLink = "inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface px-4 py-2";

export default async function ChapterPage({ params }: Props) {
  const p = await params;
  const [hit, { timezone: tz }] = await Promise.all([findChapter(p.project, p.chapter), getPublicSettings()]);
  if (!hit) notFound();
  const { work, chapter } = hit;
  const nb = chapterNeighbors(work.chapters, chapter.id);
  const minutes = readingMinutes(chapter.wordCount);
  const projectHref = worksPath(work.project.slug);
  return (
    <PublicShell>
      <ReadingChrome targetId="chapter-article" title={chapter.title} />
      <Link href={projectHref} prefetch={false} className="zen-hide mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {work.project.title}
      </Link>
      <ReaderBar />
      <article id="chapter-article" className="mt-4">
        {nb && <p className="text-sm text-muted">{bn.works.chapterOf(nb.index + 1, nb.total)}</p>}
        <h1 className="font-serif text-3xl font-bold leading-snug">{chapter.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {chapter.publishedAt && <time dateTime={chapter.publishedAt.toISOString()}>{formatDate(chapter.publishedAt, tz)} · </time>}
          {bn.works.wordCount(chapter.wordCount)}
          {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
        </p>
        <div className="reading mt-6">
          <PostBody body={chapter.body} anchors />
        </div>
      </article>
      <nav aria-label={bn.works.navLabel} className="zen-hide mt-8 flex flex-col gap-3 min-[560px]:flex-row min-[560px]:justify-between">
        {nb?.prev ? (
          <Link href={worksPath(work.project.slug, nb.prev.slug)} prefetch={false} rel="prev" className={navLink}>
            <span>
              <span className="block text-xs text-muted">{bn.works.prev}</span>
              {nb.prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {nb?.next && (
          <Link href={worksPath(work.project.slug, nb.next.slug)} prefetch={false} rel="next" className={`${navLink} min-[560px]:text-end`}>
            <span>
              <span className="block text-xs text-muted">{bn.works.next}</span>
              {nb.next.title}
            </span>
          </Link>
        )}
      </nav>
      <Link href={projectHref} prefetch={false} className="zen-hide mt-4 inline-flex min-h-11 items-center text-accent-text">
        {bn.works.toProject}
      </Link>
    </PublicShell>
  );
}
