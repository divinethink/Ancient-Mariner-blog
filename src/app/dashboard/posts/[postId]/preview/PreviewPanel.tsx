"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DiaryPage } from "@/components/diary/DiaryPage";
import { PostBody } from "@/components/public/PostBody";
import { PostArticle } from "@/components/public/PostArticle";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { countWords, docToText } from "@/lib/editorDoc";
import { readingMinutes } from "@/lib/readingTime";
import { getPostRepo } from "@/data/postRepo.wire";
import { useDiaryLook } from "../../../diary/useDiaryLook";
import { load, type State } from "../edit/PostEditor";
import { ReadingMarks } from "./ReadingMarks";

/**
 * লেখা পাবলিকে যেমন দেখাবে — একই `PostArticle`/allowlist-renderer; উৎস editor-এর মতোই (সর্বশেষ লোকাল অবস্থা,
 * প্রকাশিত লেখায় অপ্রকাশিত `drafts`-সহ — `load`-এর ক্রম)। rebuild লাগে না; কিছু লেখা হয় না।
 */
export function PreviewPanel({ postId }: { postId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { look } = useDiaryLook();
  // দিনলিপি হলে ডায়েরির পাতার চেহারায় দেখাতে দিন ও স্থান লাগে (শুধু পড়া; ব্যর্থ হলে সাধারণ প্রিভিউ)
  const [diary, setDiary] = useState<{ day: string; location?: string } | null>(null);

  useEffect(() => {
    let dead = false;
    load(postId, false).then((s) => {
      if (!dead) setState(s);
    });
    return () => {
      dead = true;
    };
  }, [postId, attempt]);

  useEffect(() => {
    let dead = false;
    getPostRepo()
      .then((r) => r.get(postId))
      .then((p) => {
        if (!dead) setDiary(p?.contentType === "diary" && p.date ? { day: p.date, location: p.location } : null);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [postId]);

  const back = (
    <Link href={`/dashboard/posts/${postId}/edit`} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
      {bn.editor.previewBack}
    </Link>
  );

  if (state.kind === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-muted">
        {bn.editor.loading}
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <div>
        {back}
        <p role="alert" className="text-muted">
          {bn.editor.loadFailed}{" "}
          <button
            type="button"
            className="min-h-11 text-accent-text underline"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            {bn.editor.retry}
          </button>
        </p>
      </div>
    );
  }

  const { title, doc } = state.data;
  const words = countWords(docToText(doc));
  const minutes = readingMinutes(words);
  return (
    <div className="mx-auto max-w-3xl">
      {back}
      <ReadingMarks postId={postId} title={title} />
      <p role="note" className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm">
        {bn.editor.previewBanner}
      </p>
      {diary ? (
        <DiaryPage day={diary.day} title={title.trim() && title !== formatDate(new Date(`${diary.day}T12:00:00Z`), "UTC") ? title : undefined} location={diary.location} look={look}>
          <div className="reading">
            <PostBody body={JSON.stringify(doc)} />
          </div>
        </DiaryPage>
      ) : (
      <PostArticle
        title={title}
        meta={
          <>
            {words} {bn.library.words}
            {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
          </>
        }
        body={JSON.stringify(doc)}
      />
      )}
    </div>
  );
}
