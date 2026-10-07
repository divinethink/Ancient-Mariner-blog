"use client";

import { useEffect, useState } from "react";
import { draftStore, type LocalDraft } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { loadRemote } from "@/data/postSync";
import { bn } from "@/i18n/bn";
import { EMPTY_DOC, docToText, makeExcerpt, parseBody } from "@/lib/editorDoc";
import { remoteChanged } from "@/lib/syncPlan";
import { EditorSurface, type Loaded } from "./EditorSurface";

export type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: Loaded };

const fromLocal = async (postId: string, l: LocalDraft, pub?: Loaded["pub"]): Promise<State> => {
  const doc = parseBody(l.body);
  return {
    kind: "ready",
    data: {
      title: l.title,
      doc,
      createdAt: l.createdAt,
      pos: await draftStore.loadPos(postId).catch(() => undefined),
      excerpt: l.excerpt,
      excerptManual: l.excerptManual ?? l.excerpt !== makeExcerpt(docToText(doc)),
      pub: pub ?? { status: "draft", hasUnpublished: false },
    },
  };
};

/**
 * ড্রাফট-ক্রম: (১) সংরক্ষণহীন (dirty) লোকাল ড্রাফট — সবচেয়ে নতুন কাজ, sync/conflict engine দেখবে;
 * (২) নইলে রিমোট (drafts/{id} → posts/{id}); রিমোট বদলে থাকলে পুরনো ক্লিন লোকাল কপি বাতিল;
 * (৩) রিমোটে না পৌঁছালে ক্লিন লোকাল কপি; (৪) কিছুই না থাকলে খালি নতুন লেখা
 */
export async function load(postId: string, isNew: boolean): Promise<State> {
  const local = await draftStore.loadDraft(postId).catch(() => undefined);
  if (local?.dirty) {
    const pub = await getPostRepo()
      .then((r) => loadRemote(r, postId))
      .then((rv) => (rv ? { status: rv.post.status === "published" ? ("published" as const) : ("draft" as const), hasUnpublished: true } : undefined))
      .catch(() => undefined);
    return fromLocal(postId, local, pub);
  }
  try {
    const repo = await getPostRepo();
    const rv = await loadRemote(repo, postId);
    if (rv) {
      const meta = await draftStore.getSync(postId).catch(() => undefined);
      const pub = {
        status: rv.post.status === "published" ? ("published" as const) : ("draft" as const),
        hasUnpublished: !!rv.draft,
      };
      if (local && !remoteChanged(rv.stamp, meta?.baseMs, local.updatedAt)) return fromLocal(postId, local, pub);
      // রিমোটই সত্য: পুরনো ক্লিন লোকাল কপি সরিয়ে base বসানো (প্রথম সম্পাদনায় conflict-যাচাই ঠিক চলবে)
      await draftStore.deleteDraft(postId).catch(() => undefined);
      await draftStore.setSync(postId, { baseMs: rv.stamp, syncedUpdatedAt: 0 }).catch(() => undefined);
      const doc = parseBody(rv.body);
      return {
        kind: "ready",
        data: {
          title: rv.title,
          doc,
          createdAt: rv.post.createdAt.getTime(),
          excerpt: rv.excerpt,
          excerptManual: rv.excerpt !== makeExcerpt(docToText(doc)),
          pub,
        },
      };
    }
  } catch {
    // নেট না পেলে: ক্লিন লোকাল কপি থাকলে তা; পুরনো লেখায় নইলে ভুল করে খালি খোলা নয়; নতুন লেখা অফলাইনেও শুরু করা যায়
    if (local) return fromLocal(postId, local);
    if (!isNew) return { kind: "error" };
  }
  if (local) return fromLocal(postId, local);
  return {
    kind: "ready",
    data: {
      title: "",
      doc: EMPTY_DOC,
      createdAt: Date.now(),
      excerpt: "",
      excerptManual: false,
      pub: { status: "draft", hasUnpublished: false },
    },
  };
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
