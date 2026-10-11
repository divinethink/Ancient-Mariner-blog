"use client";

// অধ্যায়-editor (P14a-২/৩): Tiptap ও IndexedDB লোকাল autosave reuse। সার্ভারে লেখা:
//  • draft অধ্যায়ে idle ~৫s-এ শুধু শিরোনাম+লেখা (অবস্থা/দৃশ্যমানতা কখনো নয়) — সরাসরি `chapters`-এ;
//  • প্রকাশিত অধ্যায়ে idle ~৫s-এ সম্পাদনা যায় `drafts`-এ (পাবলিক/অধ্যায়-doc অপরিবর্তিত); [আপডেট প্রকাশ করুন] = drafts → chapters, [বাতিল] = drafts মোছা;
//  • [সংরক্ষণ করুন]-এ সবকিছু (অবস্থা/দৃশ্যমানতা সহ); প্রকাশিত → draft করলে থাকা সম্পাদনা অধ্যায়ে মেশে (repo)।
// ইতিহাস (revisions): সংরক্ষণের পর ১০ মিনিটে ≤১টা, প্রকাশে একটা — সবই best-effort। পাবলিক পাতা না থাকায় rebuild-ট্রিগার নেই (P14c)।
// create idempotent: id আগে বানানো (URL-এ); multi-tab: লেখার আগে remote `updatedAt` মিলিয়ে নতুন হলে সতর্কতা (merge নেই, Arch §১২ ঙ)।
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ZodError } from "zod";
import { chapterSnapshotAfterSync, chapterSnapshotOnPublish } from "@/data/chapterRevisionHooks";
import { localStore } from "@/data/localStore";
import type { ChapterWithId, WritingProjectWithId } from "@/data/projectRepo";
import { getProjectRepo } from "@/data/projectRepo.wire";
import { bn } from "@/i18n/bn";
import { docToText, EMPTY_BODY, parseBody, sanitizeDoc, type DocNode } from "@/lib/editorDoc";
import { CHAPTER_STATUS, CHAPTER_VISIBILITY, type ChapterVisibility } from "@/lib/enums";
import { CHAPTER_TITLE_MAX, chapterWordCount } from "@/lib/projects";
import { canChapterBePublic, chapterPath, projectPath } from "@/lib/projectsUi";
import { ConfirmButton } from "../../../../ConfirmButton";

const TiptapEditor = dynamic(() => import("../../../../posts/[postId]/edit/TiptapEditor"), {
  ssr: false,
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-xl bg-line" aria-hidden />,
});

const DEBOUNCE_MS = 1000;
const SYNC_IDLE_MS = 5000;
const ghost = "min-h-11 rounded-full border border-line px-5 disabled:opacity-50";
const noop = () => undefined;
const field = "w-full rounded-lg border border-line bg-surface px-3 text-base min-h-11";
type EditableStatus = "draft" | "published";
type LocalCopy = { title: string; body: string; status: EditableStatus; visibility: ChapterVisibility; at: number };
type Phase = "loading" | "notfound" | "error" | "trashed" | "ready";
type Msg = { kind: "ok" | "err"; text: string } | null;
const localKey = (id: string) => `chapterdraft:${id}`;

export function ChapterEditor({ projectId, chapterId, isNew }: { projectId: string; chapterId: string; isNew: boolean }) {
  const t = bn.projects;
  const [phase, setPhase] = useState<Phase>("loading");
  const [project, setProject] = useState<WritingProjectWithId | null>(null);
  const [remote, setRemote] = useState<ChapterWithId | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<EditableStatus>("draft");
  const [visibility, setVisibility] = useState<ChapterVisibility>("private");
  const [initialDoc, setInitialDoc] = useState<DocNode>(parseBody(EMPTY_BODY));
  const [unsaved, setUnsaved] = useState(false);
  const [synced, setSynced] = useState(false);
  const [hasDraft, setHasDraft] = useState(false); // প্রকাশিত অধ্যায়ে অপ্রকাশিত সম্পাদনা (drafts) আছে
  const [editorKey, setEditorKey] = useState(0); // বাতিলের পর editor নতুন করে বসাতে
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const editorRef = useRef<Editor | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const form = useRef<{ title: string; status: EditableStatus; visibility: ChapterVisibility }>({ title: "", status: "draft", visibility: "private" });
  const remoteRef = useRef<ChapterWithId | null>(null); // সর্বশেষ জানা সার্ভার-অবস্থা (conflict-যাচাই ও published-গার্ড)
  const baseMs = useRef(0); // আমার দেখা/লেখা সর্বশেষ সার্ভার-সময় (অধ্যায় ও drafts-এর বড়টা); শুধু বাড়ে — ঘড়ির পার্থক্যে মিথ্যা conflict নয়
  const dirty = useRef(false); // অসংরক্ষিত লোকাল পরিবর্তন আছে কিনা (state-এর আয়না) — নইলে লোকাল কপি আর লেখা হয় না, তাই "সংরক্ষণহীন" ভুল দেখায় না
  const setDirty = useCallback((v: boolean) => {
    dirty.current = v;
    setUnsaved(v);
  }, []);
  const bump = useCallback((ms: number) => {
    baseMs.current = Math.max(baseMs.current, ms);
  }, []);
  const editVer = useRef(0);
  const busyRef = useRef(false);

  // লোড: প্রজেক্ট (অবশ্যই), অধ্যায় (থাকলে), লোকাল কপি — লোকাল নতুন হলে সেটাই
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const repo = await getProjectRepo();
        const p = await repo.getProject(projectId);
        const ch = await repo.getChapter(chapterId);
        if (!p || (ch && ch.projectId !== projectId) || (!ch && !isNew)) {
          if (!dead) setPhase("notfound");
          return;
        }
        if (ch?.status === "trashed") {
          if (!dead) {
            setProject(p);
            setPhase("trashed");
          }
          return;
        }
        const draft = ch?.status === "published" ? await repo.getChapterDraft(chapterId) : null;
        const remoteMs = Math.max(ch?.updatedAt.getTime() ?? 0, draft?.updatedAt.getTime() ?? 0);
        const local = await localStore.get<LocalCopy>(localKey(chapterId)).catch(() => undefined);
        const useLocal = !!local && (!ch || local.at > remoteMs);
        if (dead) return;
        baseMs.current = remoteMs;
        setHasDraft(!!draft);
        const ti = useLocal ? local.title : (draft?.title ?? ch?.title ?? "");
        const st: EditableStatus = useLocal ? local.status : ch?.status === "published" ? "published" : "draft";
        const vi: ChapterVisibility = useLocal ? local.visibility : (ch?.visibility ?? "private");
        form.current = { title: ti, status: st, visibility: vi };
        remoteRef.current = ch;
        setProject(p);
        setRemote(ch);
        setTitle(ti);
        setStatus(st);
        setVisibility(vi);
        setInitialDoc(parseBody(useLocal ? local.body : (draft?.body ?? ch?.body ?? EMPTY_BODY)));
        setDirty(useLocal);
        setPhase("ready");
      } catch {
        if (!dead) setPhase("error");
      }
    })();
    return () => {
      dead = true;
    };
  }, [projectId, chapterId, isNew, setDirty]);

  useEffect(
    () => () => {
      clearTimeout(localTimer.current);
      clearTimeout(syncTimer.current);
    },
    [],
  );

  const snapshot = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return null;
    const doc = sanitizeDoc(ed.getJSON());
    return { body: JSON.stringify(doc), words: chapterWordCount(docToText(doc)) };
  }, []);

  const persistLocal = useCallback(async () => {
    const snap = snapshot();
    if (!snap || !dirty.current) return;
    const f = form.current;
    await localStore.set(localKey(chapterId), { ...f, body: snap.body, at: Date.now() } satisfies LocalCopy).catch(() => undefined);
  }, [chapterId, snapshot]);

  /**
   * সার্ভারে লেখা। mode: auto = শুধু শিরোনাম+লেখা; save = বোতাম (অবস্থা/দৃশ্যমানতা সহ); publish = save + (প্রকাশিত অধ্যায়ে) drafts → chapters।
   * প্রকাশিত অধ্যায়ে শিরোনাম+লেখা সবসময় `drafts`-এ যায়, `chapters`-এ নয় (শুধু publish/অবস্থা-বদলে মেশে)।
   */
  const persist = useCallback(
    async (mode: "auto" | "save" | "publish") => {
      const snap = snapshot();
      if (!snap || busyRef.current) return;
      const full = mode !== "auto";
      const f = form.current;
      const cur = remoteRef.current;
      if (!full && f.title.trim() === "") return;
      if (full && f.title.trim() === "") {
        setMsg({ kind: "err", text: t.nameNeeded });
        return;
      }
      busyRef.current = true;
      if (full) setBusy(true);
      setMsg(null);
      const ver = editVer.current;
      try {
        const repo = await getProjectRepo();
        let saved: ChapterWithId;
        let draftNow = false;
        let becamePublished = false;
        if (!cur) {
          // প্রথম সংরক্ষণ: create (id আগে বানানো ⇒ retry/double-submit-এ duplicate নয়), তারপর (full হলে) অবস্থা/দৃশ্যমানতা
          saved = await repo.createChapter({ id: chapterId, projectId, title: f.title, body: snap.body, wordCount: snap.words });
          if (full && (f.status !== saved.status || f.visibility !== saved.visibility)) {
            saved = await repo.updateChapter(chapterId, { status: f.status, visibility: f.visibility });
          }
          becamePublished = saved.status === "published";
        } else {
          // multi-tab: অধ্যায় বা drafts আমার দেখার চেয়ে নতুন হলে লিখি না (merge নেই, Arch §১২ ঙ)
          const [fresh, freshDraft] = await Promise.all([repo.getChapter(chapterId), cur.status === "published" ? repo.getChapterDraft(chapterId) : null]);
          const freshMs = Math.max(fresh?.updatedAt.getTime() ?? 0, freshDraft?.updatedAt.getTime() ?? 0);
          if (freshMs > baseMs.current) {
            setMsg({ kind: "err", text: t.chConflict });
            return;
          }
          if (cur.status === "published") {
            const at = await repo.saveChapterEdit(chapterId, { title: f.title, body: snap.body, wordCount: snap.words });
            bump(at.getTime());
            draftNow = true;
            saved = cur;
            const statusChanged = f.status !== "published" || f.visibility !== cur.visibility;
            if (full && statusChanged) {
              saved = await repo.updateChapter(chapterId, { status: f.status, visibility: f.visibility }); // প্রকাশিত → draft হলে drafts অধ্যায়ে মেশে
              if (f.status !== "published") draftNow = false;
            }
            if (mode === "publish" && saved.status === "published") {
              const applied = await repo.applyChapterDraft(chapterId);
              if (applied) saved = applied;
              draftNow = false;
              becamePublished = true; // আপডেট-প্রকাশ: প্রকাশিত অবস্থার snapshot
            }
          } else {
            saved = await repo.updateChapter(chapterId, {
              title: f.title,
              body: snap.body,
              wordCount: snap.words,
              ...(full ? { status: f.status, visibility: f.visibility } : {}),
            });
            becamePublished = full && saved.status === "published";
          }
        }
        remoteRef.current = saved;
        setRemote(saved);
        setHasDraft(draftNow);
        bump(saved.updatedAt.getTime());
        if (editVer.current === ver) {
          await localStore.delete(localKey(chapterId)).catch(() => undefined);
          setDirty(false);
        }
        setSynced(true);
        if (full) setMsg({ kind: "ok", text: mode === "publish" ? t.chPublishedOk : t.saved });
        // ইতিহাস (best-effort — ব্যর্থ হলে মূল কাজ আটকায় না)
        if (becamePublished) void chapterSnapshotOnPublish(chapterId).catch(noop);
        else void chapterSnapshotAfterSync(chapterId, snap.body).catch(noop);
      } catch (e) {
        setMsg({ kind: "err", text: e instanceof ZodError ? t.chTooBig : t.saveFailed });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [bump, chapterId, projectId, setDirty, snapshot, t.chConflict, t.chPublishedOk, t.chTooBig, t.nameNeeded, t.saveFailed, t.saved],
  );

  /** অপ্রকাশিত সম্পাদনা বাতিল: drafts মোছা, লোকাল কপি বাদ, editor প্রকাশিত রূপে ফেরে */
  const discard = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg(null);
    try {
      clearTimeout(localTimer.current);
      clearTimeout(syncTimer.current);
      const repo = await getProjectRepo();
      await repo.discardChapterDraft(chapterId);
      await localStore.delete(localKey(chapterId)).catch(() => undefined);
      const ch = await repo.getChapter(chapterId);
      if (!ch) throw new Error("missing");
      remoteRef.current = ch;
      setRemote(ch);
      bump(ch.updatedAt.getTime());
      form.current = { title: ch.title, status: "published", visibility: ch.visibility };
      setTitle(ch.title);
      setStatus("published");
      setVisibility(ch.visibility);
      setInitialDoc(parseBody(ch.body));
      setEditorKey((k) => k + 1);
      setHasDraft(false);
      setDirty(false);
      setSynced(false);
      setMsg({ kind: "ok", text: t.chDiscarded });
    } catch {
      setMsg({ kind: "err", text: t.saveFailed });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [bump, chapterId, setDirty, t.chDiscarded, t.saveFailed]);

  const touch = useCallback(() => {
    editVer.current += 1;
    setDirty(true);
    setSynced(false);
    setMsg(null);
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => void persistLocal(), DEBOUNCE_MS);
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void persist("auto"), SYNC_IDLE_MS);
  }, [persist, persistLocal, setDirty]);

  const onEditor = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  if (phase === "loading") return <p className="text-muted">{t.loading}</p>;
  if (phase !== "ready" || !project) {
    return (
      <>
        <Link href={projectPath(projectId)} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
          {t.chBack}
        </Link>
        <p role="alert">{phase === "trashed" ? t.chTrashed : phase === "notfound" ? t.notFound : t.loadFailed}</p>
      </>
    );
  }
  const publicOk = canChapterBePublic(project.visibility);
  return (
    <div className="pb-24">
      <Link href={projectPath(projectId)} onClick={() => void persistLocal()} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        {t.chBack} · {project.title}
      </Link>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.chTitleLabel}</span>
          <input
            value={title}
            maxLength={CHAPTER_TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value);
              form.current = { ...form.current, title: e.target.value };
              touch();
            }}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t.statusLabel}</span>
            <select
              value={status}
              onChange={(e) => {
                const v = e.target.value as EditableStatus;
                setStatus(v);
                form.current = { ...form.current, status: v };
                touch();
              }}
              className={field}
            >
              {CHAPTER_STATUS.filter((s): s is EditableStatus => s !== "trashed").map((s) => (
                <option key={s} value={s}>
                  {t.statusNames[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t.visibilityLabel}</span>
            <select
              value={visibility}
              onChange={(e) => {
                const v = e.target.value as ChapterVisibility;
                setVisibility(v);
                form.current = { ...form.current, visibility: v };
                touch();
              }}
              className={field}
            >
              {CHAPTER_VISIBILITY.map((v) => (
                <option key={v} value={v} disabled={v === "public" && !publicOk && visibility !== "public"}>
                  {t.vis[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!publicOk && <p className="text-xs text-muted">{t.privateLock}</p>}
        {remote?.status === "published" && <p className="text-xs text-muted">{hasDraft || unsaved ? t.chUnpublished : t.chPublishedNote}</p>}
      </div>
      <div className="mt-4">
        <TiptapEditor key={editorKey} initialDoc={initialDoc} onContentChange={touch} onCaretMove={() => undefined} onBlur={() => void persistLocal()} onEditor={onEditor} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void persist("save")}
          className="min-h-11 rounded-full bg-btn-bg px-6 font-semibold text-btn-tx disabled:opacity-50"
        >
          {busy ? t.saving : t.save}
        </button>
        {remote?.status === "published" && status === "published" && (
          <button type="button" disabled={busy || (!hasDraft && !unsaved)} onClick={() => void persist("publish")} className={ghost}>
            {t.chPublishUpdate}
          </button>
        )}
        {remote?.status === "published" && hasDraft && (
          <ConfirmButton label={t.chDiscard} question={t.chDiscardQ} onConfirm={() => void discard()} disabled={busy} className={ghost} />
        )}
        {remote && (
          <Link href={`${chapterPath(projectId, chapterId)}/history`} onClick={() => void persistLocal()} className="inline-flex min-h-11 items-center px-2 text-accent-text">
            {t.chHistory}
          </Link>
        )}
      </div>
      {unsaved && <p className="mt-2 text-sm text-muted">{title.trim() === "" ? t.chNeedTitle : t.chUnsaved}</p>}
      {!unsaved && synced && <p className="mt-2 text-sm text-muted">{t.chSynced}</p>}
      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={`mt-2 text-sm ${msg.kind === "err" ? "text-red-700" : ""}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
