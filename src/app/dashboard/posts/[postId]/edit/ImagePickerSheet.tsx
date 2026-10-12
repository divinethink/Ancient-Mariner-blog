"use client";

// এডিটরে ছবি বাছার bottom-sheet (P6-খ): শুধু পাবলিক ছবি (CoverPicker-এর মতোই তালিকা); প্রাইভেট বাছা যায় না।
// mobile = নিচ থেকে sheet, ≥md = মাঝের modal (AddSheet-এর ধাঁচ)। বাছলে onPick(মেটা) ও বন্ধ।
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { UploadError, uploadMedia } from "@/data/mediaUpload.client";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";
import { IMAGE_MIME } from "@/lib/media";

type Props = { onClose: () => void; onPick: (m: MediaWithId) => void };

const thumb = (m: MediaWithId): string | null => {
  const cloud = cloudFromUrl(m.cloudinaryUrl);
  return cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 320 }) : null;
};

export function ImagePickerSheet({ onClose, onPick }: Props) {
  const t = bn.editor.image;
  const [items, setItems] = useState<MediaWithId[] | null>(null);
  const [next, setNext] = useState<Date | undefined>();
  const [err, setErr] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // double-tap-এ দ্বিতীয় আপলোড আটকায় (state-এর আগেই)
  const [upErr, setUpErr] = useState("");

  // বিদ্যমান আপলোড-পথ (resize ≤২০০০px, EXIF মোছা, SVG নিষিদ্ধ, ≤১০MB, sign route) — public হিসেবে; সফল হলে সরাসরি কার্সারে
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // একই ফাইল আবার বাছা যাবে
    if (!f || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setUpErr("");
    try {
      const m = await uploadMedia(await getMediaRepo(), f, "public");
      onPick(m);
      onClose();
    } catch (err) {
      const code = err instanceof UploadError ? err.code : "upload";
      setUpErr(bn.media.err[code]);
      busyRef.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    if (!busyRef.current) onClose(); // আপলোড চলার সময় বন্ধ নয় — নইলে সফল ছবি বসত না
  };

  const load = useCallback(async (after?: Date) => {
    setErr(false);
    try {
      const p = await (await getMediaRepo()).list({ type: "image", after });
      const pub = p.items.filter((m) => m.visibility === "public" && thumb(m));
      setItems((a) => (after && a ? [...a, ...pub] : pub));
      setNext(p.next);
    } catch {
      setErr(true);
    }
  }, []);

  // parent খোলার সময়ই mount করে ⇒ প্রতিবার ঢুকলে নতুন তালিকা (সদ্য আপলোড-করা ছবিও আসে)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const p = await (await getMediaRepo()).list({ type: "image" });
        if (dead) return;
        setItems(p.items.filter((m) => m.visibility === "public" && thumb(m)));
        setNext(p.next);
      } catch {
        if (!dead) setErr(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busyRef.current && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label={t.close} tabIndex={-1} onClick={close} className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="img-sheet-title"
        className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="img-sheet-title" className="font-serif text-xl font-bold">
            {t.title}
          </h2>
          <button
            type="button"
            aria-label={t.close}
            disabled={busy}
            onClick={close}
            className="flex disabled:opacity-40 size-11 items-center justify-center rounded-full text-xl text-muted hover:bg-line"
          >
            ✕
          </button>
        </div>

        <div className="mb-3">
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => fileRef.current?.click()}
            className="min-h-11 w-full rounded-full border border-line px-4 font-semibold disabled:opacity-50"
          >
            {busy ? t.uploading : t.upload}
          </button>
          <input ref={fileRef} type="file" accept={IMAGE_MIME.join(",")} onChange={onFile} className="hidden" />
          {upErr && (
            <p role="alert" className="mt-2 text-sm text-accent-text">
              {upErr}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {err && (
            <p role="alert" className="text-sm text-accent-text">
              {t.error}{" "}
              <button type="button" className="min-h-11 underline" onClick={() => load()}>
                {bn.media.retry}
              </button>
            </p>
          )}
          {items === null && !err && <p className="text-sm text-muted">{t.loading}</p>}
          {items?.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}
          <ul className="grid grid-cols-3 gap-2">
            {items?.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-label={m.altText || m.fileName}
                  onClick={() => {
                    onPick(m);
                    onClose();
                  }}
                  className="block aspect-square w-full overflow-hidden rounded-xl border-2 border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(m) ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {next && (
            <button type="button" className="mt-2 min-h-11 rounded-full border border-line px-4" onClick={() => load(next)}>
              {bn.media.more}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">{t.hint}</p>
      </div>
    </div>
  );
}
