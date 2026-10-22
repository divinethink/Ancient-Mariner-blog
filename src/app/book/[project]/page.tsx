import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/public/PostBody";
import { PublicShell } from "@/components/public/PublicShell";
import { ReadingChrome } from "@/components/public/ReadingChrome";
import { ReaderBar } from "@/components/public/ReaderTools";
import { findWork, safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings } from "@/data/publicSnapshot";
import { getPublicWorks } from "@/data/worksSnapshot";
import { bn } from "@/i18n/bn";
import { typeLabel } from "@/lib/projectType";
import { worksPath } from "@/lib/projects";
import { buildSeo } from "@/lib/seo";
import { projectExcerpt, worksWordTotal } from "@/lib/works";

// Book Mode (P14c-২): প্রজেক্টের সব published+public অধ্যায় এক-কলামে টানা। static; schema বদল নেই।
// অধ্যায়ের নিজস্ব পাতার হুবহু লেখা ⇒ duplicate-content এড়াতে noindex ও sitemap-এ নেই; canonical = প্রজেক্ট-পাতা।
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ project: string }> };

const BIG_WORDS = 150_000; // এর বেশি হলে build-লগে সতর্কতা (পেজ-আকার)

export async function generateStaticParams() {
  const works = await getPublicWorks();
  for (const w of works) {
    const words = worksWordTotal(w.chapters);
    if (words > BIG_WORDS) console.warn(`⚠️ Book Mode "${w.project.slug}": ${words} শব্দ — পেজ বড় হবে`);
  }
  return works.filter((w) => w.chapters.length > 0).map((w) => ({ project: w.project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [work, { siteTitle }] = await Promise.all([findWork((await params).project), getPublicSettings()]);
  if (!work) return {};
  const m = buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${bn.works.bookTitle(work.project.title)} — ${siteTitle}`,
    description: projectExcerpt(work.project.description) || bn.works.metaDescription,
    path: worksPath(work.project.slug),
    allowIndexing: false, // noindex সবসময়
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
  return m;
}

export default async function BookPage({ params }: Props) {
  const work = await findWork((await params).project);
  if (!work || work.chapters.length === 0) notFound();
  const { project, chapters } = work;
  return (
    <PublicShell>
      <ReadingChrome title={project.title} />
      <ReaderBar>
        <Link href={worksPath(project.slug)} prefetch={false} className="zen-hide inline-flex min-h-11 items-center text-accent-text">
          ← {project.title}
        </Link>
      </ReaderBar>
      <article id="book-article" className="mt-4">
        <p className="text-sm text-muted">{typeLabel(project.type, bn.works.types)}</p>
        <h1 className="font-serif text-3xl font-bold leading-snug">{project.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {bn.works.chapterCount(chapters.length)} · {bn.works.wordCount(worksWordTotal(chapters))}
        </p>
        <nav aria-label={bn.works.bookToc} className="zen-hide mt-6">
          <h2 className="font-serif text-xl font-bold">{bn.works.bookToc}</h2>
          <ol className="mt-2 flex flex-col">
            {chapters.map((c, i) => (
              <li key={c.id} className="border-b border-line">
                <a href={`#c-${c.id}`} className="flex min-h-11 items-center py-2">
                  <span className="text-muted">{(i + 1).toLocaleString("bn-BD")}.&nbsp;</span>
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {chapters.map((c) => (
          <section key={c.id} id={`c-${c.id}`} className="mt-12 scroll-mt-16">
            <h2 className="font-serif text-2xl font-bold leading-snug">{c.title}</h2>
            <div className="reading mt-4">
              <PostBody body={c.body} />
            </div>
            <Link href={worksPath(project.slug, c.slug)} prefetch={false} className="zen-hide mt-2 inline-flex min-h-11 items-center text-sm text-accent-text">
              {bn.works.bookOpenChapter}
            </Link>
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
