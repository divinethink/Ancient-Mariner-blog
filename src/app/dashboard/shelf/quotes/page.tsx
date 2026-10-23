import Link from "next/link";
import { bn } from "@/i18n/bn";
import { QuoteList } from "./QuoteList";

export default function QuotesPage() {
  return (
    <>
      <Link href="/dashboard/shelf" className="mb-3 inline-flex min-h-11 items-center gap-1 text-accent-text">
        {bn.shelf.back}
      </Link>
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.shelf.quotesTitle}</h1>
      <p className="mb-4 text-sm text-muted">{bn.shelf.quotesIntro}</p>
      <QuoteList />
    </>
  );
}
