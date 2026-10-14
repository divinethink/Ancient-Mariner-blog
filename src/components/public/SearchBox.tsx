import { Icon } from "@/components/icons";
import { bn } from "@/i18n/bn";
import { SEARCH_PATH } from "@/lib/publicSearch";

/** পাবলিক সাইটের একমাত্র সার্চ-ফর্ম: JS ছাড়াই চলা GET → /search?q= (P10a-২)। জায়গা (সাইডবার/মেনু/নেভ) অনুযায়ী `className`। */
export function SearchBox({ className = "" }: { className?: string }) {
  return (
    <form role="search" action={SEARCH_PATH} method="get" className={`items-center gap-1 ${className}`}>
      <input type="search" name="q" aria-label={bn.publicSearch.headerLabel} placeholder={bn.publicSearch.headerLabel} autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base" />
      <button type="submit" aria-label={bn.publicSearch.button} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
        <Icon name="search" size={20} />
      </button>
    </form>
  );
}
