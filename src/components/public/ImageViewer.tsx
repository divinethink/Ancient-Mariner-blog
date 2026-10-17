"use client";

// লেখার ভেতরের ছবিতে ক্লিক/ট্যাপে পুরো ছবি (native <dialog> — Gallery-র একই কৌশল; নতুন লাইব্রেরি নেই)।
// event-delegation: `.reading-figure img[data-full]`-এ ক্লিক/Enter/Space; একই পাতায় একাধিক PostBody থাকলেও একটাই সাড়া দেয়।
// প্রথম render-এ কিছুই আঁকে না (server markup অক্ষত); বড় ছবি শুধু খোলার পরে আনে।
// কেন JSX নয়: PostBody.ts (vitest-এ লোড হয়, যেখানে JSX পার্স হয় না) এটা import করে — তাই createElement (PostBody.ts-এর মতোই)।
import { createElement as h, useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";

type Shown = { src: string; alt: string };
const SEL = ".reading-figure img[data-full]";

export function ImageViewer() {
  const [shown, setShown] = useState<Shown | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const open = (el: Element | null) => {
      const img = el?.closest?.(SEL) as HTMLImageElement | null;
      const src = img?.dataset.full;
      if (!img || !src) return false;
      opener.current = img;
      setShown({ src, alt: img.alt.replace(/ — .*$/, "") });
      return true;
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return; // অন্য ImageViewer আগেই সামলেছে
      if (open(e.target as Element)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.key !== "Enter" && e.key !== " ")) return;
      if (open(e.target as Element)) e.preventDefault();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (d && shown && !d.open) d.showModal();
  }, [shown]);

  if (!shown) return null;
  const close = () => dlg.current?.close();
  return h(
    "dialog",
    {
      ref: dlg,
      "aria-label": bn.public.imageOpen,
      onClose: () => {
        setShown(null);
        opener.current?.focus();
      },
      onClick: (e: { target: unknown }) => {
        if (e.target === dlg.current) close(); // পেছনে চাপলে বন্ধ
      },
      className: "m-auto h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90",
    },
    h(
      "div",
      { className: "relative flex h-full w-full items-center justify-center p-3", onClick: close },
      // Cloudinary-ই optimizer (Arch §১২) — তাই সাধারণ <img>
      h("img", { src: shown.src, alt: shown.alt, decoding: "async", className: "max-h-full max-w-full object-contain" }),
      h(
        "button",
        {
          type: "button",
          "aria-label": bn.public.imageClose,
          onClick: close,
          className: "absolute end-3 top-3 flex size-12 items-center justify-center rounded-full bg-black/50 text-2xl text-white",
          style: { top: "max(12px, env(safe-area-inset-top, 0px))" },
        },
        "✕",
      ),
    ),
  );
}
