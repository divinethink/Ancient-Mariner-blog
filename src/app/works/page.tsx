import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { safeSiteUrl } from "@/components/public/worksRoute";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings } from "@/data/publicSnapshot";
import { getPublicWorks } from "@/data/worksSnapshot";
import { bn } from "@/i18n/bn";
import { typeLabel } from "@/lib/projectType";
import { worksPath } from "@/lib/projects";
import { buildSeo } from "@/lib/seo";
import { projectExcerpt, worksWordTotal } from "@/lib/works";

// build-সময়ে static; ডেটা `.build-data/works.json` থেকে (published+public প্রজেক্ট)। `body` এই পেজে নেই (P14c-১)
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, allowIndexing } = await getPublicSettings();
  return buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${bn.works.title} — ${siteTitle}`,
    description: bn.works.metaDescription,
    path: worksPath(),
    allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function WorksIndex() {
  const works = await getPublicWorks();
  return (
    <PublicShell>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <h1 className="font-serif text-3xl font-bold">{bn.works.title}</h1>
      {works.length === 0 ? (
        <p className="mt-6 text-muted">{bn.works.empty}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {works.map(({ project, chapters }) => (
            <li key={project.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm text-muted">{typeLabel(project.type, bn.works.types)}</p>
              <h2 className="font-serif text-xl font-bold">
                <Link href={worksPath(project.slug)} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
                  {project.title}
                </Link>
              </h2>
              {project.description && <p className="mt-1">{projectExcerpt(project.description)}</p>}
              <p className="mt-2 text-sm text-muted">
                {chapters.length === 0 ? bn.works.noChapters : `${bn.works.chapterCount(chapters.length)} · ${bn.works.wordCount(worksWordTotal(chapters))}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
