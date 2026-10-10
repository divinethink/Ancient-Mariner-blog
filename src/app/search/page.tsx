import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { bn } from "@/i18n/bn";
import { SearchClient } from "./SearchClient";

// static (build-সময়ে prerender); খোঁজ ব্রাউজারে `search-index.json` দিয়ে (P10a-২)। নিজে সার্চ-ইঞ্জিনে নয়, sitemap-এও নেই।
export const dynamic = "force-static";
export const metadata: Metadata = { title: bn.publicSearch.title, robots: { index: false, follow: true } };

export default function SearchPage() {
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{bn.publicSearch.heading}</h1>
      <SearchClient />
    </PublicShell>
  );
}
