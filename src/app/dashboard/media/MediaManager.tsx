"use client";

// মিডিয়া-লাইব্রেরি (Mockup §৭.১২ list-pattern): আপলোড (গ্যালারি/ক্যামেরা), ফিল্টার, alt/caption, লিংক-কপি, মোছা।
// সব ডেটা-কাজ data-layer (mediaRepo / mediaUpload) দিয়ে; আপলোড একটার পর একটা; মোছা দুই-ধাপ confirm, Cloudinary আগে।
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import type { MediaWithId } from "@/data/mediaRepo";
import { deleteMedia, privateMediaUrl, UploadError, uploadMedia } from "@/data/mediaUpload.client";
import { Icon } from "@/components/icons";
import { Segmented } from "@/components/ui/Segmented";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";
import { FILE_EXT } from "@/lib/media";
import { ConfirmButton } from "../ConfirmButton";

type Filter = "" | "image" | "file";
type Status = "loading" | "error" | "ready";

const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const primary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
const menuItem = "flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-line/40 disabled:opacity-50";
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
  const [menu, setMenu] = useState<string | null>(null); // খোলা "⋯" মেনু (একসাথে একটা)
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
      </div>

      <div className="mb-4 space-y-2">
        <Segmented
          label={t.uploadAs}
          showLabel
          value={vis}
          onChange={setVis}
          options={[
            { value: "public", label: t.pub },
            { value: "private", label: t.priv },
          ]}
        />
        <Segmented
          label={t.show}
          showLabel
          value={filter}
          onChange={changeFilter}
          options={[
            { value: "", label: t.all },
            { value: "image", label: t.images },
            { value: "file", label: t.files },
          ]}
        />
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

      <ul className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3">
        {status === "ready" &&
          items.map((m) => {
            const src = thumb(m);
            const open = menu === m.id;
            return (
              <li
                key={m.id}
                className={`rounded-2xl border border-line bg-surface p-2 ${editing === m.id ? "col-span-2 lg:col-span-3" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMenu(null);
                }}
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-line/40 text-3xl">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={m.altText || m.fileName} loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span aria-hidden>{m.visibility === "private" ? "🔒" : m.type === "image" ? "🖼️" : "📄"}</span>
                  )}
                </div>
                <div className="mt-2 flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={m.fileName}>
                      {m.fileName}
                    </p>
                    <p className="text-xs text-muted">
                      {sizeText(m.size)}
                      {m.width && m.height ? ` · ${nf.format(m.width)}×${nf.format(m.height)}` : ""}
                      {m.visibility === "private" ? ` · ${t.privateTag}` : ""}
                    </p>
                  </div>
                  {editing !== m.id && (
                    <button
                      type="button"
                      aria-label={`${t.actions}: ${m.fileName}`}
                      aria-expanded={open}
                      aria-controls={`mm-${m.id}`}
                      onClick={() => setMenu(open ? null : m.id)}
                      className={`-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full ${open ? "bg-line/60" : ""}`}
                    >
                      <Icon name="more" />
                    </button>
                  )}
                </div>

                {editing === m.id ? (
                  <div className="mt-2">
                    <MetaForm m={m} busy={busy === m.id} onSave={onSaveMeta} onCancel={() => setEditing(null)} />
                  </div>
                ) : (
                  open && (
                    <div id={`mm-${m.id}`} className="mt-1 border-t border-line pt-1 text-sm">
                      <button
                        type="button"
                        className={menuItem}
                        onClick={() => {
                          setMenu(null);
                          setEditing(m.id);
                        }}
                      >
                        {t.edit}
                      </button>
                      {m.visibility === "public" && m.cloudinaryUrl && (
                        <button type="button" className={menuItem} onClick={() => onCopy(m)}>
                          {copied === m.id ? t.copied : t.copy}
                        </button>
                      )}
                      {m.visibility === "private" &&
                        (opened?.id === m.id ? (
                          <a href={opened.url} target="_blank" rel="noopener noreferrer" className={menuItem}>
                            {t.openNow}
                          </a>
                        ) : (
                          <button type="button" className={menuItem} disabled={busy === m.id} onClick={() => onOpenPrivate(m)}>
                            {t.openPrivate}
                          </button>
                        ))}
                      <div className="px-1 py-1">
                        <ConfirmButton
                          label={t.del}
                          question={t.delQ}
                          disabled={busy === m.id}
                          onConfirm={() => onDelete(m)}
                          className={`${menuItem} px-2 text-red-600 dark:text-red-400`}
                        />
                      </div>
                    </div>
                  )
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
