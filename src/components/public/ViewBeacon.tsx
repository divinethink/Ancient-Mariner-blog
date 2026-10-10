"use client";
import { useEffect } from "react";

const KEY = "viewSent"; // { [postId]: "YYYY-MM-DD" (ডিভাইসের আজ) } — আজ পাঠানো হলে আর নয় (Worker request বাঁচাতে, Arch §৭)

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** পাবলিক লেখার পাতায় অদৃশ্য view-beacon: লোড শেষে idle-এ দিনে একবার `POST /api/view`; ব্যর্থতা নীরব, JS/storage বন্ধ থাকলে কিছুই হয় না */
export function ViewBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    const run = () => {
      const day = today();
      let sent: Record<string, string> = {};
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
        if (raw && typeof raw === "object") sent = raw as Record<string, string>;
      } catch {
        /* ভাঙা/নেই — নতুন */
      }
      if (sent[postId] === day) return;
      let ref = "";
      try {
        ref = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        /* অবৈধ referrer = direct */
      }
      fetch("/api/view", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, referrer: ref }),
      })
        .then((r) => {
          if (!r.ok) return;
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(sent)) if (v === day) next[k] = v; // পুরনো দিনের entry ছাঁটা
          next[postId] = day;
          try {
            localStorage.setItem(KEY, JSON.stringify(next));
          } catch {
            /* storage বন্ধ — server-dedupe-ই রক্ষা করে */
          }
        })
        .catch(() => {});
    };
    const t = window.setTimeout(run, 2000);
    return () => window.clearTimeout(t);
  }, [postId]);
  return null;
}
