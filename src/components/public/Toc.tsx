import { bn } from "@/i18n/bn";
import type { TocItem } from "@/lib/toc";

/** স্বয়ংক্রিয় সূচি; খালি হলে কিছু দেখায় না। `<details>` (JS লাগে না), মোবাইলে বন্ধ থাকলেও এক-ট্যাপে খোলে */
export function Toc({ items }: { items: readonly TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={bn.public.tocLabel} className="zen-hide mt-6 rounded-2xl border border-line bg-surface px-4 py-1">
      <details>
        <summary className="inline-flex min-h-11 w-full cursor-pointer items-center font-semibold">{bn.public.tocTitle}</summary>
        <ol className="pb-3">
          {items.map((i) => (
            <li key={i.id} className={i.level === 3 ? "ps-4" : ""}>
              <a href={`#${i.id}`} className="inline-flex min-h-11 items-center text-accent-text">
                {i.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
