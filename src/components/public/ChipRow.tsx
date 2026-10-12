"use client";
import { useState } from "react";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { CardLink } from "@/lib/cards";

const chip = "inline-flex min-h-10 items-center rounded-full border border-line px-3 text-sm";

/** লেখার পাতার ক্যাটাগরি/ট্যাগ: প্রথম `limit`টি দেখায়, বাকি "+N আরও" বোতামে; JS বন্ধ থাকলেও প্রথম কয়েকটি লিংকসহ দেখা যায় */
export function ChipRow({ links, limit = 3 }: { links: readonly CardLink[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const hidden = links.length - limit;
  const shown = all || hidden <= 0 ? links : links.slice(0, limit);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {shown.map((l) =>
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
      {hidden > 0 && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`${chip} text-muted`}>
          {all ? bn.public.lessTags : bn.public.moreTags(hidden)}
        </button>
      )}
    </div>
  );
}
