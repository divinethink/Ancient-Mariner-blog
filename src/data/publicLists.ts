// পাবলিক তালিকা-scope (blog/category/tag/series) — snapshot থেকে, প্রতি worker-এ একবার (Arch §২ 'build একবারই সব পড়ে')।
import { getPublicMedia, getPublicSettings, getPublicTerms, listPublicPosts } from "@/data/publicSnapshot";
import { buildScopes, type Scope } from "@/lib/publicLists";

let memo: Promise<Scope[]> | undefined;

export function getPublicScopes(): Promise<Scope[]> {
  memo ??= Promise.all([listPublicPosts(), getPublicTerms(), getPublicSettings(), getPublicMedia()]).then(([posts, terms, s, media]) =>
    buildScopes({ posts, terms, timeZone: s.timezone, media }),
  );
  return memo;
}
