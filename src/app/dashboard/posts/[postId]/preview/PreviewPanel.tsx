"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostArticle } from "@/components/public/PostArticle";
import { bn } from "@/i18n/bn";
import { countWords, docToText } from "@/lib/editorDoc";
import { readingMinutes } from "@/lib/readingTime";
import { load, type State } from "../edit/PostEditor";
import { ReadingMarks } from "./ReadingMarks";

/**
 * লেখা পাবলিকে যেমন দেখাবে — একই `PostArticle`/allowlist-renderer; উৎস editor-এর মতোই (সর্বশেষ লোকাল অবস্থা,
 * প্রকাশিত লেখায় অপ্রকাশিত `drafts`-সহ — `load`-এর ক্রম)। rebuild লাগে না; কিছু লেখা হয় না।
 */
export function PreviewPanel({ postId }: { postId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    load(postId, false).then((s) => {
      if (!dead) setState(s);
    });
    return () => {
      dead = true;
    };
  }, [postId, attempt]);

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
    </div>
  );
}
