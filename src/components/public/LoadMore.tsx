"use client";
import { useState } from "react";
import { bn } from "@/i18n/bn";
import { cardChunkPath, type CardView } from "@/lib/cards";
import { PostCardList } from "./PostCard";

/** [আরও দেখান]: build-সময়ের card-JSON chunk fetch (Firestore নয়, Arch §২); ব্যর্থ হলে স্পষ্ট error + আবার চেষ্টা */
/**
 * `initial`: সার্ভারে আগে থেকে জানা, কিন্তু লুকানো কার্ড — প্রথম ক্লিকে নেটওয়ার্ক ছাড়াই দেখায় (হোমের ৬টির পরের বাকি প্রথম-পেজ)।
 * `exclude`: যে id আগেই পেজে দেখানো (featured/প্রথম ৬টি) — chunk থেকে এলে বাদ, ডুপ্লিকেট নয়।
 */
export function LoadMore({ scopeKey, chunks, initial = [], exclude = [] }: { scopeKey: string; chunks: number; initial?: readonly CardView[]; exclude?: readonly string[] }) {
  const [pending, setPending] = useState<readonly CardView[]>(initial);
  const [loaded, setLoaded] = useState<CardView[]>([]);
  const [next, setNext] = useState(2); // chunk-নম্বর ২ থেকে
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (pending.length > 0) {
      setLoaded((l) => [...l, ...pending]);
      setPending([]);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(cardChunkPath(scopeKey, next), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(String(res.status));
      const items = (await res.json()) as CardView[];
      const seen = new Set<string>([...exclude, ...initial.map((c) => c.id)]);
      setLoaded((l) => [...l, ...items.filter((c) => !seen.has(c.id) && !l.some((x) => x.id === c.id))]);
      setNext((n) => n + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {loaded.length > 0 && (
        <div className="mt-4">
          <PostCardList cards={loaded} />
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {bn.public.loadFailed}
        </p>
      )}
      {(pending.length > 0 || next <= chunks + 1) && (
        <button
          type="button"
          onClick={more}
          disabled={busy}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-btn-bg px-5 text-btn-tx disabled:opacity-60"
        >
          {busy ? bn.public.loading : failed ? bn.public.retry : bn.public.loadMore}
        </button>
      )}
    </>
  );
}
