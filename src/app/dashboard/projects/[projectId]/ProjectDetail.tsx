"use client";

// প্রজেক্ট-detail (Mockup §৭.২৪): অগ্রগতি, প্রজেক্ট-সেটিং, অধ্যায়-তালিকা (↑↓ ক্রম), ট্র্যাশ। সাইটে দৃশ্যমান বদল হলে (published+public) সাইট rebuild-এর অনুরোধ যায় (P14c-২; `lib/works`-এর `*AffectsSite`)।
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProjectHasChaptersError,
  ProjectRuleError,
  type ChapterWithId,
  type WritingProjectWithId,
} from "@/data/projectRepo";
import { getProjectRepo } from "@/data/projectRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { PROJECT_STATUS, PROJECT_VISIBILITY, type ProjectStatus, type ProjectVisibility } from "@/lib/enums";
import { resolveType, splitType } from "@/lib/projectType";
import { ProjectTypeField } from "../ProjectTypeField";
import { newId } from "@/lib/id";
import { MAX_CHAPTERS_PER_PROJECT, moveId, projectProgress } from "@/lib/projects";
import { chapterPath, newChapterPath } from "@/lib/projectsUi";
import { chapterAffectsSite, projectAffectsSite, visibleOrderChanged } from "@/lib/works";
import { ConfirmButton } from "../../ConfirmButton";

type Load = { kind: "loading" } | { kind: "notfound" } | { kind: "error" } | { kind: "ready" };
type Msg = { kind: "ok" | "err"; text: string } | null;
const field = "w-full rounded-lg border border-line bg-surface px-3 text-base min-h-11";
const small = "min-h-11 min-w-11 rounded-full border border-line px-3 text-sm disabled:opacity-40";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const t = bn.projects;
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  const [project, setProject] = useState<WritingProjectWithId | null>(null);
  const [all, setAll] = useState<ChapterWithId[]>([]); // ট্র্যাশ সহ
  const [title, setTitle] = useState("");
  const [typeSel, setTypeSel] = useState("novel");
  const [typeCustom, setTypeCustom] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [vis, setVis] = useState<ProjectVisibility>("private");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const busyRef = useRef(false);

  const fill = useCallback((p: WritingProjectWithId) => {
    setProject(p);
    setTitle(p.title);
    const sp = splitType(p.type);
    setTypeSel(sp.select);
    setTypeCustom(sp.custom);
    setDesc(p.description);
    setTarget(p.targetWords ? String(p.targetWords) : "");
    setStatus(p.status);
    setVis(p.visibility);
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const repo = await getProjectRepo();
        const p = await repo.getProject(projectId);
        if (!p) {
          if (!dead) setLoad({ kind: "notfound" });
          return;
        }
        const chs = await repo.listChapters(projectId, { includeTrashed: true });
        if (dead) return;
        fill(p);
        setAll(chs);
        setLoad({ kind: "ready" });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [projectId, tick, fill]);

  /** একটাই কাজ একসাথে (double-tap/overlap নয়); ব্যর্থ হলে বার্তা */
  /** fn `true` ফেরালে (সাইটে দৃশ্যমান বদল) কাজের পর rebuild-অনুরোধ যায় */
  async function run(fn: () => Promise<boolean | void>, okText?: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const affects = await fn();
      const rebuilt = affects ? await triggerSiteRebuild() : null;
      const text = [okText, rebuilt === null ? "" : rebuilt ? bn.build.liveIn : bn.build.triggerFailed].filter(Boolean).join(" ");
      if (text) setMsg({ kind: rebuilt === false ? "err" : "ok", text });
    } catch (e) {
      if (e instanceof ProjectHasChaptersError) setMsg({ kind: "err", text: `${e.count}টি ${t.hasChapters}` });
      else if (e instanceof ProjectRuleError) {
        setMsg({ kind: "err", text: t.staleList });
        setTick((n) => n + 1);
      } else setMsg({ kind: "err", text: t.actionFailed });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const live = all.filter((c) => c.status !== "trashed");
  const trashed = all.filter((c) => c.status === "trashed");

  const onSave = () =>
    run(async () => {
      const tw = target.trim() === "" ? null : Number(target);
      if (tw !== null && (!Number.isInteger(tw) || tw < 0)) throw new Error("bad target");
      const type = resolveType(typeSel, typeCustom, t.types);
      if (!type) throw new Error("type needed");
      const before = project;
      const after = await (await getProjectRepo()).updateProject(projectId, { title, type, description: desc, status, visibility: vis, targetWords: tw });
      fill(after);
      return projectAffectsSite(before, after);
    }, t.saved);

  const onMove = (id: string, dir: "up" | "down") =>
    run(async () => {
      const next = await (await getProjectRepo()).reorderChapters(projectId, moveId(live.map((c) => c.id), id, dir));
      setAll([...next, ...trashed]);
      return visibleOrderChanged(project, live, next);
    });

  const onTrash = (id: string) =>
    run(async () => {
      const before = all.find((x) => x.id === id) ?? null;
      const c = await (await getProjectRepo()).trashChapter(id);
      setAll((cur) => cur.map((x) => (x.id === id ? c : x)));
      return chapterAffectsSite(project, before, c);
    });
  const onRestore = (id: string) =>
    run(async () => {
      const before = all.find((x) => x.id === id) ?? null;
      const c = await (await getProjectRepo()).restoreChapter(id);
      setAll((cur) => cur.map((x) => (x.id === id ? c : x)));
      return chapterAffectsSite(project, before, c);
    });
  const onDeleteChapter = (id: string) =>
    run(async () => {
      await (await getProjectRepo()).deleteChapter(id);
      setAll((cur) => cur.filter((x) => x.id !== id));
    });
  const onDeleteProject = () =>
    run(async () => {
      await (await getProjectRepo()).deleteProject(projectId);
      if (projectAffectsSite(project, null)) await triggerSiteRebuild(); // অনুরোধ ব্যর্থ হলেও মোছা সম্পন্ন — build-status সতর্কতা দেখাবে
      router.push("/dashboard/projects");
    });

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind !== "ready" || !project) {
    return (
      <>
        <Link href="/dashboard/projects" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
          {t.back}
        </Link>
        <p role="alert">{load.kind === "notfound" ? t.notFound : t.loadFailed}</p>
        {load.kind === "error" && (
          <button type="button" onClick={() => setTick((n) => n + 1)} className="mt-3 min-h-11 rounded-full border border-line px-4">
            {t.retry}
          </button>
        )}
      </>
    );
  }

  const prog = projectProgress(live, project.targetWords);
  const atLimit = all.length >= MAX_CHAPTERS_PER_PROJECT;
  return (
    <div className="pb-24">
      <Link href="/dashboard/projects" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        {t.back}
      </Link>
      <h1 className="mb-3 font-serif text-3xl font-bold">{project.title}</h1>

      <section className="mb-5 rounded-2xl border border-line bg-surface p-4" aria-label="অগ্রগতি">
        <p className="text-sm">
          {prog.chapters}
          {t.chapterCount} · {prog.published} {t.published} · {prog.words} {t.words}
          {prog.percent !== null && ` · ${prog.percent}%`}
        </p>
        {prog.percent !== null && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={prog.percent}
            className="mt-2 h-2 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-accent" style={{ width: `${prog.percent}%` }} />
          </div>
        )}
      </section>

      <section className="mb-6" aria-label={t.chapters}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-bold">{t.chapters}</h2>
          <button
            type="button"
            disabled={atLimit}
            onClick={() => router.push(newChapterPath(projectId, newId()))}
            className="min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50"
          >
            {t.newChapter}
          </button>
        </div>
        {atLimit && <p className="mb-2 text-sm text-muted">{t.chapterLimit}</p>}
        {live.length === 0 ? (
          <p className="text-muted">{t.noChapters}</p>
        ) : (
          <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {live.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Link href={chapterPath(projectId, c.id)} className="min-w-0 flex-1 py-1">
                  <span className="block truncate font-serif font-bold">
                    {i + 1}. {c.title}
                  </span>
                  <span className="block text-sm text-muted">
                    {t.statusNames[c.status === "published" ? "published" : "draft"]} · {t.vis[c.visibility]} · {c.wordCount} {t.words}
                  </span>
                </Link>
                <button type="button" disabled={busy || i === 0} onClick={() => void onMove(c.id, "up")} aria-label={t.moveUp} className={small}>
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || i === live.length - 1}
                  onClick={() => void onMove(c.id, "down")}
                  aria-label={t.moveDown}
                  className={small}
                >
                  ↓
                </button>
                <button type="button" disabled={busy} onClick={() => void onTrash(c.id)} className={small}>
                  {t.trash}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mb-6 space-y-3 rounded-2xl border border-line bg-surface p-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.titleLabel}</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <ProjectTypeField select={typeSel} custom={typeCustom} onSelect={setTypeSel} onCustom={setTypeCustom} />
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.descLabel}</span>
          <textarea value={desc} maxLength={500} rows={3} onChange={(e) => setDesc(e.target.value)} className={`${field} py-2`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.targetLabel}</span>
          <input value={target} inputMode="numeric" onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.statusLabel}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={field}>
            {PROJECT_STATUS.map((x) => (
              <option key={x} value={x}>
                {t.statusNames[x]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.visibilityLabel}</span>
          <select value={vis} onChange={(e) => setVis(e.target.value as ProjectVisibility)} className={field}>
            {PROJECT_VISIBILITY.map((x) => (
              <option key={x} value={x}>
                {t.vis[x]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{t.publicNote}</p>
        <button
          type="button"
          disabled={busy || title.trim() === ""}
          onClick={() => void onSave()}
          className="min-h-11 rounded-full bg-btn-bg px-6 font-semibold text-btn-tx disabled:opacity-50"
        >
          {busy ? t.saving : t.save}
        </button>
      </section>

      {trashed.length > 0 && (
        <section className="mb-6" aria-label={t.trashedTitle}>
          <h2 className="mb-2 font-serif text-xl font-bold">{t.trashedTitle}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {trashed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <button type="button" disabled={busy} onClick={() => void onRestore(c.id)} className={small}>
                  {t.restore}
                </button>
                <ConfirmButton
                  label={t.deletePerm}
                  question={t.deletePermQ}
                  disabled={busy}
                  onConfirm={() => void onDeleteChapter(c.id)}
                  className={small}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmButton
        label={t.deleteProject}
        question={t.deleteProjectQ}
        disabled={busy}
        onConfirm={() => void onDeleteProject()}
        className="min-h-11 rounded-full border border-line px-4 disabled:opacity-50"
      />
      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={`mt-3 text-sm ${msg.kind === "err" ? "text-red-700" : ""}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
