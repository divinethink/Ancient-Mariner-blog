"use client";

// পাবলিক পোস্টের ছবি-গ্যালারি (P8a-২): grid + native <dialog> lightbox (নতুন লাইব্রেরি নেই; focus-trap/Esc ব্রাউজারের)।
// ছবি lazy; Cloudinary srcset; thumb-এ জায়গা আগে ধরা (aspect-square) ⇒ CLS নেই। lightbox-এর বড় ছবি শুধু খোলার পরে আনে।
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import type { CoverView } from "@/lib/cards";
import { cldSrcSet, cldUrl } from "@/lib/cloudinary";

const nav = "absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white";

export function Gallery({ items }: { items: readonly CoverView[] }) {
  const [cur, setCur] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const n = items.length;

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (cur !== null && !d.open) d.showModal();
    if (cur === null && d.open) d.close();
  }, [cur]);

  if (n === 0) return null;
  const go = (d: 1 | -1) => setCur((c) => (c === null ? c : (c + d + n) % n));
  const it = cur !== null ? items[cur] : null;

  return (
    <section aria-label={bn.gallery.section} className="mt-8">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((g, i) => {
          const src = cldUrl(g.cloud, g.publicId, { w: 480 });
          if (!src) return null;
          return (
            <li key={`${g.publicId}-${i}`}>
              <button
                type="button"
                aria-label={g.alt ? `${g.alt} — ${bn.gallery.open(i + 1, n)}` : bn.gallery.open(i + 1, n)}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setCur(i);
                }}
                className="relative block aspect-square w-full overflow-hidden rounded-xl bg-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-ই optimizer (Arch §১২) */}
                <img src={src} alt={g.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dlg}
        aria-label={bn.gallery.dialog}
        onClose={() => {
          setCur(null);
          opener.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dlg.current) setCur(null); // পেছনে চাপলে বন্ধ
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          else if (e.key === "ArrowLeft") go(-1);
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
      >
        {it && cur !== null && (
          <div className="relative flex h-full w-full items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-ই optimizer (Arch §১২) */}
            <img
              src={cldUrl(it.cloud, it.publicId, { w: 1280 }) ?? ""}
              srcSet={cldSrcSet(it.cloud, it.publicId, it.w ?? 2000) ?? undefined}
              sizes="100vw"
              alt={it.alt}
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
            <button type="button" aria-label={bn.gallery.close} onClick={() => setCur(null)} className="absolute right-3 top-3 flex size-12 items-center justify-center rounded-full bg-black/50 text-xl text-white">
              ✕
            </button>
            {n > 1 && (
              <>
                <button type="button" aria-label={bn.gallery.prev} onClick={() => go(-1)} className={`${nav} left-2`}>
                  ‹
                </button>
                <button type="button" aria-label={bn.gallery.next} onClick={() => go(1)} className={`${nav} right-2`}>
                  ›
                </button>
              </>
            )}
            <p className="absolute bottom-3 left-0 right-0 text-center text-sm text-white" aria-live="polite">
              {cur + 1}/{n}
              {it.alt ? ` · ${it.alt}` : ""}
            </p>
          </div>
        )}
      </dialog>
    </section>
  );
}
