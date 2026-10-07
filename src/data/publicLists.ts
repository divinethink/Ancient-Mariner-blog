// পাবলিক তালিকা-scope (blog/category/tag/series) — snapshot থেকে, প্রতি worker-এ একবার (Arch §২ 'build একবারই সব পড়ে')।
import { getPublicSettings, getPublicTerms, listPublicPosts } from "@/data/publicSnapshot";
import { buildScopes, type Scope } from "@/lib/publicLists";

let memo: Promise<Scope[]> | undefined;

export function getPublicScopes(): Promise<Scope[]> {
  memo ??= Promise.all([listPublicPosts(), getPublicTerms(), getPublicSettings()]).then(([posts, terms, s]) =>
    buildScopes({ posts, terms, timeZone: s.timezone }),
  );
  return memo;
}
