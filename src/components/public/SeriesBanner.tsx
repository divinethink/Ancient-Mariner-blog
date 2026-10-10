import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardView } from "@/lib/cards";

const btn = "inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm";

/** "সিরিজ: নাম — পর্ব X/Y [← পূর্ব | পরবর্তী →]" (শিরোনামের ওপরে) */
export function SeriesBanner({ name, path, index, total, prev, next }: { name: string; path: string; index: number; total: number; prev?: CardView; next?: CardView }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-2 text-sm">
      <span>
        {bn.public.seriesLabel}{" "}
        <Link href={path} prefetch={false} className="font-semibold text-accent-text">
          {name}
        </Link>{" "}
        — {bn.public.seriesPart(index + 1, total)}
      </span>
      <span className="ms-auto flex flex-wrap gap-2">
        {prev && (
          <Link href={prev.href} prefetch={false} rel="prev" className={btn}>
            {bn.public.seriesPrev}
          </Link>
        )}
        {next && (
          <Link href={next.href} prefetch={false} rel="next" className={btn}>
            {bn.public.seriesNext}
          </Link>
        )}
      </span>
    </div>
  );
}
