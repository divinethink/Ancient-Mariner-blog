import Link from "next/link";
import { toPostCard } from "@/data/postRepo";
import { listPublicPosts } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { DEFAULT_POSTS_PER_PAGE, blogPath, postExcerpt } from "@/lib/publicSite";

// build-সময়ে prerender; পাঠক-রিকোয়েস্টে Worker চলে না (Arch §১২)। card-এ `body` নেই (toPostCard)।
export const dynamic = "force-static";

export default async function Home() {
  const posts = await listPublicPosts();
  const cards = posts
    .slice(0, DEFAULT_POSTS_PER_PAGE)
    .map((p) => ({ ...toPostCard(p), excerpt: postExcerpt(p) }));
  return (
    <>
      <h1 className="font-serif text-3xl font-bold">{bn.siteName}</h1>
      <h2 className="mb-4 mt-8 font-serif text-xl font-bold">{bn.public.latest}</h2>
      {cards.length === 0 ? (
        <p className="text-muted">{bn.public.empty}</p>
      ) : (
        <ul className="space-y-4">
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                href={blogPath(c.slug)}
                prefetch={false}
                className="block rounded-2xl border border-line bg-surface p-4"
              >
                <span className="block font-serif text-xl font-bold leading-snug">
                  {c.title || bn.library.untitled}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {c.publishedAt && <time dateTime={c.publishedAt.toISOString()}>{formatDate(c.publishedAt)}</time>}
                  {" · "}
                  {c.wordCount} {bn.library.words}
                </span>
                {c.excerpt && <span className="mt-2 line-clamp-2 block text-muted">{c.excerpt}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
