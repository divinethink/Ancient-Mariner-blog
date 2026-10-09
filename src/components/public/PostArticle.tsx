import type { ReactNode } from "react";
import Link from "next/link";
import { Cover } from "@/components/public/Cover";
import { PostBody } from "@/components/public/PostBody";
import { bn } from "@/i18n/bn";
import type { CardLink, CoverView } from "@/lib/cards";

const chip = "inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm";

/** লেখার পাতা: পাবলিক `/blog/[slug]` ও owner-প্রিভিউ দুই জায়গায় একই (শিরোনাম, meta, chip, allowlist-renderer) — Arch §১৭ P4a */
export function PostArticle({
  title,
  meta,
  links = [],
  body,
  cover,
}: {
  title: string;
  meta: ReactNode;
  links?: readonly CardLink[];
  body: string;
  /** পাবলিক পেজে লেখার cover (প্রিভিউ-তে নেই) */
  cover?: CoverView;
}) {
  return (
    <article>
      <h1 className="font-serif text-3xl font-bold leading-snug">{title || bn.library.untitled}</h1>
      <p className="mt-2 text-sm text-muted">{meta}</p>
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {links.map((l) =>
            l.href ? (
              <Link key={l.name} href={l.href} prefetch={false} className={`${chip} text-accent-text`}>
                {l.name}
              </Link>
            ) : (
              <span key={l.name} className={`${chip} text-muted`}>
                {l.name}
              </span>
            ),
          )}
        </div>
      )}
      {cover && (
        <figure className="mt-4 overflow-hidden rounded-2xl bg-line">
          <Cover cover={cover} mode="natural" priority sizes="(min-width: 768px) 720px, 100vw" />
        </figure>
      )}
      <div className="reading mt-6">
        <PostBody body={body} />
      </div>
    </article>
  );
}
