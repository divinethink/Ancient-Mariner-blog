"use client";

// Settings-এ ডিফল্ট ক্যাটাগরি select (Mockup §৭.১১)। siteSettings-এর বাকি ফর্ম/schema অপরিবর্তিত —
// শুধু `defaultCategoryId` taxonomyOps দিয়ে merge হয়; সাইটের পাবলিক পেজে প্রভাব নেই, তাই rebuild নয়।
import { useEffect, useState } from "react";
import { getTaxonomyOps } from "@/data/taxonomyOps.wire";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import { bn } from "@/i18n/bn";
import { buildCategoryTree } from "@/lib/taxonomy";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; cats: { id: string; name: string; parentCategoryId?: string }[]; current: string };

export function DefaultCategoryField() {
  const t = bn.org.defaultCat;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let dead = false;
    Promise.all([getTaxonomyRepo("categories").then((r) => r.list()), getTaxonomyOps().then((o) => o.getDefaultCategoryId())])
      .then(([cats, id]) => {
        if (!dead) setState({ kind: "ready", cats, current: id && cats.some((c) => c.id === id) ? id : "" });
      })
      .catch(() => {
        if (!dead) setState({ kind: "error" });
      });
    return () => {
      dead = true;
    };
  }, []);

  if (state.kind === "loading") return null;
  if (state.kind === "error") {
    return (
      <p role="alert" className="text-sm text-accent-text">
        {bn.org.loadFailed}
      </p>
    );
  }

  async function change(id: string) {
    if (busy || !id || state.kind !== "ready") return;
    setBusy(true);
    setMsg(null);
    try {
      await (await getTaxonomyOps()).setDefaultCategory(id);
      setState({ ...state, current: id });
      setMsg({ ok: true, text: t.saved });
    } catch {
      setMsg({ ok: false, text: t.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <label className="block">
        <span className="font-serif text-lg font-bold">{t.label}</span>
        <select
          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3"
          value={state.current}
          disabled={busy}
          onChange={(e) => void change(e.target.value)}
        >
          {state.current === "" && <option value="">{t.unset}</option>}
          {buildCategoryTree(state.cats).map(({ term, depth }) => (
            <option key={term.id} value={term.id}>
              {depth ? "— " : ""}
              {term.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm text-muted">{t.hint}</span>
      </label>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
