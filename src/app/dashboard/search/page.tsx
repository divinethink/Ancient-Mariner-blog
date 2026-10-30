import { bn } from "@/i18n/bn";
import { CONTENT_TYPE } from "@/lib/enums";
import { SearchView } from "./SearchView";

// ?q= = palette/লিংক থেকে আসা শুরুর শব্দ; ?type= = লেখার ধরনে সীমাবদ্ধ (যেমন diary) — অজানা মান উপেক্ষা
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q;
  const t = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const type = (CONTENT_TYPE as readonly string[]).includes(t ?? "") ? (t as string) : "";
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.search.title}</h1>
      <SearchView initialQuery={(Array.isArray(q) ? q[0] : q)?.slice(0, 200) ?? ""} initialType={type} />
    </>
  );
}
