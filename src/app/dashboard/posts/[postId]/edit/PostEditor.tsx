"use client";

import { useEffect, useState } from "react";
import { draftStore } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { EMPTY_DOC, parseBody } from "@/lib/editorDoc";
import { EditorSurface, type Loaded } from "./EditorSurface";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: Loaded };

/** লোকাল ড্রাফট আগে (সবচেয়ে নতুন কাজ); না থাকলে Firestore: drafts/{id} → posts/{id}; কিছুই না থাকলে খালি নতুন লেখা */
async function load(postId: string, isNew: boolean): Promise<State> {
  const local = await draftStore.loadDraft(postId).catch(() => undefined);
  if (local) {
    const pos = await draftStore.loadPos(postId).catch(() => undefined);
    return {
      kind: "ready",
      data: { title: local.title, doc: parseBody(local.body), createdAt: local.createdAt, pos },
    };
  }
  try {
    const repo = await getPostRepo();
    const draft = await repo.getDraft(postId);
    const post = draft ? null : await repo.get(postId);
    if (draft || post) {
      const pos = await draftStore.loadPos(postId).catch(() => undefined);
      return {
        kind: "ready",
        data: {
          title: draft?.title ?? post?.title ?? "",
          doc: parseBody(draft?.body ?? post?.body ?? ""),
          createdAt: (post?.createdAt ?? draft?.updatedAt ?? new Date()).getTime(),
          pos,
        },
      };
    }
  } catch {
    // পুরনো লেখা খুলতে নেট না পেলে ভুল করে খালি খোলা নয়; নতুন লেখা অফলাইনেও শুরু করা যায়
    if (!isNew) return { kind: "error" };
  }
  return { kind: "ready", data: { title: "", doc: EMPTY_DOC, createdAt: Date.now() } };
}

export function PostEditor({ postId, isNew }: { postId: string; isNew: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    load(postId, isNew).then((s) => {
      if (!dead) setState(s);
    });
    return () => {
      dead = true;
    };
  }, [postId, isNew, attempt]);

  if (state.kind === "ready") return <EditorSurface postId={postId} data={state.data} />;
  if (state.kind === "error") {
    return (
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
    );
  }
  return (
    <p role="status" aria-live="polite" className="text-muted">
      {bn.editor.loading}
    </p>
  );
}
