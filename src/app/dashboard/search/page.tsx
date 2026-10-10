import { bn } from "@/i18n/bn";
import { SearchView } from "./SearchView";

// ?q= = palette/লিংক থেকে আসা শুরুর শব্দ
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = (await searchParams).q;
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.search.title}</h1>
      <SearchView initialQuery={(Array.isArray(q) ? q[0] : q)?.slice(0, 200) ?? ""} />
    </>
  );
}
