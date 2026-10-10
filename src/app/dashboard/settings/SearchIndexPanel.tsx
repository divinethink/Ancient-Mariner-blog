"use client";

import { useState } from "react";
import { syncSearchIndex } from "@/data/searchIndex.wire";
import { bn } from "@/i18n/bn";

/** খোঁজ-index নতুন করে বানানো (P8b): পূর্ণ sync + স্থায়ীভাবে-মোছা লেখার entry সরানো। পুরনো index নষ্ট করে না — ব্যর্থ হলে আগেরটাই থাকে। */
export function SearchIndexPanel() {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [n, setN] = useState(0);

  async function rebuild() {
    if (state === "busy") return; // double-tap-এ দ্বিতীয় run নয়
    setState("busy");
    try {
      const r = await syncSearchIndex({ full: true });
      setN(r.total);
      setState("ok");
    } catch {
      setState("fail");
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{bn.search.rebuildTitle}</h2>
      <p className="mt-1 text-sm text-muted">{bn.search.rebuildHint}</p>
      <button
        type="button"
        onClick={() => void rebuild()}
        disabled={state === "busy"}
        className="mt-3 min-h-11 rounded-lg border border-line px-4"
      >
        {state === "busy" ? bn.search.rebuilding : bn.search.rebuildBtn}
      </button>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-muted">
        {state === "ok" ? bn.search.rebuilt(n) : state === "fail" ? bn.search.rebuildFailed : ""}
      </p>
    </section>
  );
}
