"use client";

// পেজ-তালিকা (Mockup §৭.১৬): শিরোনাম · /slug · অবস্থা; system পেজ চিহ্নিত। খোলার সময় about/privacy seed (idempotent, বিদ্যমান অক্ষত)।
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PageWithId } from "@/data/pageRepo";
import { getPageRepo } from "@/data/pageRepo.wire";
import { bn } from "@/i18n/bn";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: PageWithId[] };

export function PageList() {
  const t = bn.pages;
  const [tick, setTick] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const repo = await getPageRepo();
        await repo.ensureSystemPages();
        const items = await repo.list();
        if (!dead) setLoad({ kind: "ready", items });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [tick]);

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind === "error") {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-4">
        <p>{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ kind: "loading" });
            setTick((n) => n + 1);
          }}
          className="mt-3 min-h-11 rounded-full border border-line px-4"
        >
          {t.retry}
        </button>
      </div>
    );
  }
  return (
    <>
      <Link href="/dashboard/pages/edit" className="mb-4 inline-flex min-h-11 items-center rounded-full bg-btn-bg px-5 font-semibold text-btn-tx">
        {t.newPage}
      </Link>
      {load.items.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {load.items.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/dashboard/pages/edit?slug=${encodeURIComponent(p.slug)}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif font-bold">📄 {p.title || bn.library.untitled}</span>
                  <span className="block truncate text-sm text-muted">
                    /{p.slug}
                    {p.system && ` · ${t.system}`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-line px-3 text-xs">{p.status === "published" ? t.published : t.draft}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
