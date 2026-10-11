"use client";

// প্রজেক্ট-তালিকা (Mockup §৭.২৪): নাম · ধরন · অবস্থা। অগ্রগতি-% এখানে নয় — তা পড়তে প্রতি প্রজেক্টের সব অধ্যায়ের body আনতে হয় (খরচ), তাই detail-পাতায়।
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProjectRuleError, type WritingProjectWithId } from "@/data/projectRepo";
import { getProjectRepo } from "@/data/projectRepo.wire";
import { bn } from "@/i18n/bn";
import { PROJECT_TYPE, type ProjectType } from "@/lib/enums";
import { newId } from "@/lib/id";
import { newChapterPath, projectPath } from "@/lib/projectsUi";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: WritingProjectWithId[] };
const field = "w-full rounded-lg border border-line bg-surface px-3 text-base min-h-11";

export function ProjectList({ pick }: { pick: boolean }) {
  const t = bn.projects;
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProjectType>("novel");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const idRef = useRef<string>("");
  const busyRef = useRef(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const items = await (await getProjectRepo()).listProjects();
        if (!dead) setLoad({ kind: "ready", items });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [tick]);

  async function onCreate() {
    if (busyRef.current) return; // double-tap গার্ড
    if (!title.trim()) {
      setErr(t.nameNeeded);
      return;
    }
    if (idRef.current === "") idRef.current = newId(); // retry-তে একই id ⇒ create idempotent
    busyRef.current = true;
    setBusy(true);
    setErr("");
    try {
      const p = await (await getProjectRepo()).createProject({ id: idRef.current, title, type });
      idRef.current = "";
      router.push(projectPath(p.id));
    } catch (e) {
      setErr(e instanceof ProjectRuleError ? e.message : t.createFailed);
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind === "error") {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-4">
        <p>{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ kind: "loading" });
            setTick((n) => n + 1);
          }}
          className="mt-3 min-h-11 rounded-full border border-line px-4"
        >
          {t.retry}
        </button>
      </div>
    );
  }
  return (
    <>
      {!pick && (
        <section className="mb-5 space-y-3 rounded-2xl border border-line bg-surface p-4" aria-label={t.newProject}>
          <h2 className="font-serif text-lg font-bold">{t.newProject}</h2>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t.titleLabel}</span>
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t.typeLabel}</span>
            <select value={type} onChange={(e) => setType(e.target.value as ProjectType)} className={field}>
              {PROJECT_TYPE.map((x) => (
                <option key={x} value={x}>
                  {t.types[x]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCreate()}
            className="min-h-11 rounded-full bg-btn-bg px-6 font-semibold text-btn-tx disabled:opacity-50"
          >
            {busy ? t.creating : t.create}
          </button>
          {err && (
            <p role="alert" className="text-sm text-red-700">
              {err}
            </p>
          )}
        </section>
      )}
      {load.items.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {load.items.map((p) => (
            <li key={p.id}>
              {pick ? (
                <button
                  type="button"
                  onClick={() => router.push(newChapterPath(p.id, newId()))}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
                >
                  <Row p={p} />
                </button>
              ) : (
                <Link href={projectPath(p.id)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                  <Row p={p} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Row({ p }: { p: WritingProjectWithId }) {
  const t = bn.projects;
  return (
    <>
      <span className="min-w-0">
        <span className="block truncate font-serif font-bold">📖 {p.title}</span>
        <span className="block truncate text-sm text-muted">
          {t.types[p.type]} · {t.vis[p.visibility]}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-line px-3 text-xs">{t.statusNames[p.status]}</span>
    </>
  );
}
