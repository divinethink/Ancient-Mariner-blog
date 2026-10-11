import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { findWork, safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings } from "@/data/publicSnapshot";
import { getPublicWorks } from "@/data/worksSnapshot";
import { bn } from "@/i18n/bn";
import { worksPath } from "@/lib/projects";
import { buildSeo } from "@/lib/seo";
import { projectExcerpt, worksWordTotal } from "@/lib/works";

// build-সময়ে শুধু published+public প্রজেক্ট; অন্য slug = 404 (Arch §১৭ P14c)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ project: string }> };

export async function generateStaticParams() {
  return (await getPublicWorks()).map((w) => ({ project: w.project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [work, { siteTitle, allowIndexing }] = await Promise.all([findWork((await params).project), getPublicSettings()]);
  if (!work) return {};
  return buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${work.project.title} — ${siteTitle}`,
    description: projectExcerpt(work.project.description) || bn.works.metaDescription,
    path: worksPath(work.project.slug),
    allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function WorkPage({ params }: Props) {
  const work = await findWork((await params).project);
  if (!work) notFound();
  const { project, chapters } = work;
  return (
    <PublicShell>
      <nav aria-label={bn.public.breadcrumbLabel} className="text-sm text-muted">
        <Link href={worksPath()} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
          ← {bn.works.title}
        </Link>
      </nav>
      <p className="mt-1 text-sm text-muted">{bn.works.types[project.type]}</p>
      <h1 className="font-serif text-3xl font-bold leading-snug">{project.title}</h1>
      {project.description && <p className="mt-3 whitespace-pre-line">{project.description}</p>}
      {chapters.length > 0 && (
        <>
          <p className="mt-3 text-sm text-muted">
            {bn.works.chapterCount(chapters.length)} · {bn.works.wordCount(worksWordTotal(chapters))}
          </p>
          <Link href={worksPath(project.slug, chapters[0].slug)} prefetch={false} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 py-2 text-accent-text">
            {bn.works.startReading}
          </Link>
          <h2 className="mt-8 font-serif text-xl font-bold">{bn.works.chapterList}</h2>
          <ol className="mt-3 flex flex-col">
            {chapters.map((c, i) => (
              <li key={c.id} className="border-b border-line">
                <Link href={worksPath(project.slug, c.slug)} prefetch={false} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span>
                    <span className="text-muted">{(i + 1).toLocaleString("bn-BD")}. </span>
                    {c.title}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{bn.works.wordCount(c.wordCount)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
      {chapters.length === 0 && <p className="mt-6 text-muted">{bn.works.noChapters}</p>}
    </PublicShell>
  );
}
