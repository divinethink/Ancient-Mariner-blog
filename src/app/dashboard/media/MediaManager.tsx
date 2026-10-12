"use client";

// মিডিয়া-লাইব্রেরি (Mockup §৭.১২ list-pattern): আপলোড (গ্যালারি/ক্যামেরা), ফিল্টার, alt/caption, লিংক-কপি, মোছা।
// সব ডেটা-কাজ data-layer (mediaRepo / mediaUpload) দিয়ে; আপলোড একটার পর একটা; মোছা দুই-ধাপ confirm, Cloudinary আগে।
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import type { MediaWithId } from "@/data/mediaRepo";
import { deleteMedia, privateMediaUrl, UploadError, uploadMedia } from "@/data/mediaUpload.client";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";
import { FILE_EXT } from "@/lib/media";
import { ConfirmButton } from "../ConfirmButton";

type Filter = "" | "image" | "file";
type Status = "loading" | "error" | "ready";

const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const primary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
const field = "w-full rounded-lg border border-line bg-surface px-3 text-base";
// শুধু ছবির MIME দিলে মোবাইলে গ্যালারি/ফটো-পিকার আসে; এক্সটেনশন মেশালে সাধারণ ফাইল-চুজার আসে।
const acceptImages = "image/jpeg,image/png,image/webp,image/gif";
const acceptFiles = FILE_EXT.map((e) => `.${e}`).join(",");

const nf = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 });
const sizeText = (b: number) => (b >= 1048576 ? `${nf.format(b / 1048576)} MB` : `${nf.format(Math.max(1, b / 1024))} KB`);

function thumb(m: MediaWithId): string | null {
  const cloud = cloudFromUrl(m.cloudinaryUrl);
  return m.type === "image" && m.visibility === "public" && cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 320 }) : null;
}

export function MediaManager() {
  const t = bn.media;
  const [filter, setFilter] = useState<Filter>("");
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<MediaWithId[]>([]);
  const [next, setNext] = useState<Date | undefined>();
  const [vis, setVis] = useState<"public" | "private">("public");
  const [progress, setProgress] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ id: string; url: string } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const p = await (await getMediaRepo()).list({ type: filter || undefined });
        if (dead) return;
        setItems(p.items);
        setNext(p.next);
        setStatus("ready");
      } catch {
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
    };
  }, [filter, tick]);

  function changeFilter(f: Filter) {
    setStatus("loading");
    setFilter(f);
  }
  function retry() {
    setStatus("loading");
    setTick((n) => n + 1);
  }

  async function loadMore() {
    if (!next || busy) return;
    setBusy("more");
    try {
      const p = await (await getMediaRepo()).list({ type: filter || undefined, after: next });
      setItems((a) => [...a, ...p.items.filter((x) => !a.some((y) => y.id === x.id))]);
      setNext(p.next);
    } catch {
      setNotes([t.actionFailed]);
    }
    setBusy(null);
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // একই ফাইল আবার বাছা যাবে
    if (files.length === 0 || progress) return;
    const errs: string[] = [];
    const repo = await getMediaRepo();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`${t.uploading} (${i + 1}/${files.length}): ${f.name}`);
      try {
        const m = await uploadMedia(repo, f, vis);
        setItems((a) => (a.some((x) => x.id === m.id) || (filter && filter !== m.type) ? a : [m, ...a]));
      } catch (err) {
        const code = err instanceof UploadError ? err.code : "upload";
        errs.push(`${f.name}: ${t.err[code]}${err instanceof UploadError && err.detail ? ` (${err.detail})` : ""}`);
      }
    }
    setNotes(errs);
    setProgress(null);
  }

  async function onDelete(m: MediaWithId) {
    if (busy) return;
    setBusy(m.id);
    setNotes([]);
    try {
      await deleteMedia(await getMediaRepo(), m);
      setItems((a) => a.filter((x) => x.id !== m.id));
    } catch {
      setNotes([`${m.fileName}: ${t.actionFailed}`]);
    }
    setBusy(null);
  }

  async function onSaveMeta(m: MediaWithId, altText: string, caption: string) {
    if (busy) return;
    setBusy(m.id);
    try {
      const u = await (await getMediaRepo()).updateMeta(m.id, { altText, caption });
      setItems((a) => a.map((x) => (x.id === m.id ? u : x)));
      setEditing(null);
    } catch {
      setNotes([t.actionFailed]);
    }
    setBusy(null);
  }

  async function onCopy(m: MediaWithId) {
    if (!m.cloudinaryUrl) return;
    try {
      await navigator.clipboard.writeText(m.cloudinaryUrl);
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 2000);
    } catch {
      setNotes([t.actionFailed]);
    }
  }

  async function onOpenPrivate(m: MediaWithId) {
    if (busy) return;
    setBusy(m.id);
    try {
      setOpened({ id: m.id, url: await privateMediaUrl(m) });
    } catch {
      setNotes([t.actionFailed]);
    }
    setBusy(null);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={!!progress} onClick={() => galleryRef.current?.click()}>
          {t.upload}
        </button>
        <button type="button" className={ghost} disabled={!!progress} onClick={() => cameraRef.current?.click()}>
          {t.camera}
        </button>
        <button type="button" className={ghost} disabled={!!progress} onClick={() => fileRef.current?.click()}>
          {t.pickFile}
        </button>
        <input ref={galleryRef} type="file" multiple accept={acceptImages} onChange={onFiles} className="hidden" />
        <input ref={fileRef} type="file" multiple accept={acceptFiles} onChange={onFiles} className="hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFiles} className="hidden" />
        <fieldset className="flex items-center gap-1" aria-label={t.visibility}>
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vis === v}
              onClick={() => setVis(v)}
              className={`min-h-11 rounded-full border px-4 ${vis === v ? "border-accent bg-accent/10 text-accent-text" : "border-line"}`}
            >
              {v === "public" ? t.pub : t.priv}
            </button>
          ))}
        </fieldset>
      </div>

      {progress && (
        <p role="status" className="mb-3 text-sm">
          {progress}
        </p>
      )}
      {notes.length > 0 && (
        <ul role="alert" className="mb-3 list-disc pl-5 text-sm text-red-600 dark:text-red-400">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t.title}>
        {([["", t.all], ["image", t.images], ["file", t.files]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter === v}
            onClick={() => changeFilter(v)}
            className={`min-h-11 rounded-full border px-4 ${filter === v ? "border-accent bg-accent/10 text-accent-text" : "border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="text-muted">{t.loading}</p>}
      {status === "error" && (
        <p>
          {t.loadError}{" "}
          <button type="button" className={ghost} onClick={retry}>
            {t.retry}
          </button>
        </p>
      )}
      {status === "ready" && items.length === 0 && <p className="text-muted">{t.empty}</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {status === "ready" &&
          items.map((m) => {
            const src = thumb(m);
            return (
              <li key={m.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-line/40 text-3xl">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={m.altText || m.fileName} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden>{m.visibility === "private" ? "🔒" : m.type === "image" ? "🖼️" : "📄"}</span>
                  )}
                </div>
                <p className="break-all font-semibold">{m.fileName}</p>
                <p className="mb-2 text-sm text-muted">
                  {sizeText(m.size)}
                  {m.width && m.height ? ` · ${nf.format(m.width)}×${nf.format(m.height)}` : ""}
                  {m.visibility === "private" ? ` · ${t.privateTag}` : ""}
                </p>

                {editing === m.id ? (
                  <MetaForm m={m} busy={busy === m.id} onSave={onSaveMeta} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={ghost} onClick={() => setEditing(m.id)}>
                      {t.edit}
                    </button>
                    {m.visibility === "public" && m.cloudinaryUrl && (
                      <button type="button" className={ghost} onClick={() => onCopy(m)}>
                        {copied === m.id ? t.copied : t.copy}
                      </button>
                    )}
                    {m.visibility === "private" &&
                      (opened?.id === m.id ? (
                        <a href={opened.url} target="_blank" rel="noopener noreferrer" className={`${ghost} inline-flex items-center`}>
                          {t.openNow}
                        </a>
                      ) : (
                        <button type="button" className={ghost} disabled={busy === m.id} onClick={() => onOpenPrivate(m)}>
                          {t.openPrivate}
                        </button>
                      ))}
                    <ConfirmButton label={t.del} question={t.delQ} disabled={busy === m.id} onConfirm={() => onDelete(m)} className={ghost} />
                  </div>
                )}
              </li>
            );
          })}
      </ul>

      {status === "ready" && next && (
        <p className="mt-4">
          <button type="button" className={ghost} disabled={busy === "more"} onClick={loadMore}>
            {t.more}
          </button>
        </p>
      )}
    </div>
  );
}

function MetaForm(p: {
  m: MediaWithId;
  busy: boolean;
  onSave: (m: MediaWithId, alt: string, caption: string) => void;
  onCancel: () => void;
}) {
  const t = bn.media;
  const [alt, setAlt] = useState(p.m.altText ?? "");
  const [cap, setCap] = useState(p.m.caption ?? "");
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        {t.alt}
        <input className={`${field} min-h-11`} maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        {t.caption}
        <input className={`${field} min-h-11`} maxLength={300} value={cap} onChange={(e) => setCap(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={primary} disabled={p.busy} onClick={() => p.onSave(p.m, alt, cap)}>
          {t.save}
        </button>
        <button type="button" className={ghost} onClick={p.onCancel}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
