"use client";

// নতুন-প্রকাশ তাৎক্ষণিক (A-lite): ব্র্যান্ডেড 404-এ `/blog/<slug>` হলে `GET /api/live/<slug>` ডেকে লেখাটি একই `PostArticle`-এ দেখায়।
// না পেলে/ব্যর্থ হলে সাধারণ 404 (children) ফেরে — আগের আচরণ অক্ষত। rebuild শেষে আসল static পেজ নিজেই দখল নেয়।
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PostArticle } from "@/components/public/PostArticle";
import type { LivePost } from "@/data/liveRead";
import { bn } from "@/i18n/bn";
import { formatBnNumber, formatDate } from "@/lib/datetime";
import { readingMinutes } from "@/lib/readingTime";

const BLOG_PATH = /^\/blog\/([^/]+)\/?$/;
const TIMEOUT_MS = 8000;

export function LiveNotFound({ children }: { children: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<LivePost | null>(null);

  useLayoutEffect(() => {
    const m = BLOG_PATH.exec(window.location.pathname);
    if (!m) return;
    const el = holder.current;
    if (el) el.style.visibility = "hidden"; // 404-লেখা ঝলকে না দেখাতে (DOM-এ সরাসরি; ব্যর্থ হলে ফেরত)
    const show = () => {
      if (el) el.style.visibility = "";
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    fetch(`/api/live/${m[1]}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ post?: LivePost }>) : null))
      .then((j) => {
        if (j?.post) setPost(j.post);
        else show();
      })
      .catch(show)
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, []);

  useEffect(() => {
    if (post) document.title = post.title || bn.library.untitled;
  }, [post]);

  if (!post) return <div ref={holder}>{children}</div>;
  const minutes = readingMinutes(post.wordCount);
  const meta = (
    <>
      {post.publishedAt && <time dateTime={post.publishedAt}>{formatDate(new Date(post.publishedAt))}</time>}
      {" · "}
      {formatBnNumber(post.wordCount)} {bn.library.words}
      {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
      {post.location && ` · 📍 ${post.location}`}
    </>
  );
  return (
    <>
      <p className="mb-4">
        <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center text-accent-text">
          ← {bn.public.home}
        </Link>
      </p>
      <PostArticle
        title={post.title}
        meta={meta}
        links={post.categoryName ? [{ name: post.categoryName }] : []}
        body={post.body}
        cover={post.cover}
        gallery={post.gallery}
        poem={post.poem}
        media={new Map(Object.entries(post.media))}
      />
    </>
  );
}
