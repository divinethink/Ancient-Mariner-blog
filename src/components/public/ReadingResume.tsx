"use client";
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { READ_PROGRESS_KEY, parseProgress, recordProgress, resumeFraction, serializeProgress } from "@/lib/readProgress";

const SAVE_DELAY = 600; // ms — scroll থামার পর একবার লেখা

function load() {
  try {
    return parseProgress(localStorage.getItem(READ_PROGRESS_KEY));
  } catch {
    return {};
  }
}

/**
 * পাঠকের পড়ার-অগ্রগতি ও resume (P12-২): লেখার কতটা পড়া হলো পাঠকের ব্রাউজারেই (localStorage) থাকে — সার্ভারে কিছু যায় না।
 * ফিরলে নিচে ছোট প্রস্তাব-বার; "চালু করুন" চাপলে সেখানে স্ক্রল, নইলে শুরু থেকে। প্রস্তাবের সময় নতুন অগ্রগতি লেখা বন্ধ (শুরুর ০ দিয়ে পুরনো মান মুছে না যাক)।
 * scroll-এ React re-render নেই; listener passive, লেখা debounce-করা। storage বন্ধ/ভরা থাকলে চুপচাপ বাদ; JS বন্ধ থাকলে লেখা অক্ষত।
 */
export function ReadingResume({ slug, targetId }: { slug: string; targetId: string }) {
  const [offer, setOffer] = useState<number | null>(null);
  const holding = useRef(false);

  const fraction = () => {
    const el = document.getElementById(targetId);
    if (!el) return null;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    return { top, span, p: span > 0 ? (window.scrollY - top) / span : 0 };
  };

  useEffect(() => {
    const f = resumeFraction(load(), slug);
    // পাতা শুরুর কাছে থাকলে (anchor/হ্যাশ-লিংক ছাড়া) প্রস্তাব দাও
    if (f !== null && window.scrollY < 200 && !window.location.hash) {
      holding.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage শুধু mount-এর পরে পড়া যায় (SSR/hydration নিরাপদ রাখতে)
      setOffer(f);
    }
    let timer = 0;
    const save = () => {
      timer = 0;
      if (holding.current) return;
      const r = fraction();
      if (!r) return;
      try {
        localStorage.setItem(READ_PROGRESS_KEY, serializeProgress(recordProgress(load(), slug, r.p, Date.now())));
      } catch {
        /* storage বন্ধ/ভরা — অগ্রগতি রাখা যাবে না, পড়া অক্ষত */
      }
    };
    const onScroll = () => {
      if (!holding.current && !timer) timer = window.setTimeout(save, SAVE_DELAY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, targetId]);

  if (offer === null) return null;

  const dismiss = () => {
    holding.current = false;
    setOffer(null);
  };
  const resume = () => {
    const r = fraction();
    if (r && r.span > 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.round(r.top + offer * r.span), behavior: reduce ? "auto" : "smooth" });
    }
    dismiss();
  };

  return (
    <div role="status" className="fixed inset-x-3 z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
      <span className="min-w-0 flex-1 text-sm">{bn.public.resumeAt(Math.round(offer * 100))}</span>
      <button type="button" onClick={resume} className="inline-flex min-h-11 items-center rounded-full bg-accent/15 px-4 text-sm font-semibold text-accent-text">
        {bn.public.resumeYes}
      </button>
      <button type="button" onClick={dismiss} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm">
        {bn.public.resumeNo}
      </button>
    </div>
  );
}
