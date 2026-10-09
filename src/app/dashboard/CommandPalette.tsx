"use client";

// Command palette (Ctrl/⌘+K; ≥1024px) — DashboardShell থেকে next/dynamic-এ lazy-load। matching = lib/palette।
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import {
  matchItems,
  mergePalette,
  moveIndex,
  PALETTE_LIMIT,
  type PaletteItem,
} from "@/lib/palette";
import { useAdd } from "./AddSheet";
import { getPaletteTitles } from "./paletteSource";

const P = bn.palette;
const COMMANDS: (PaletteItem & { href?: string })[] = [
  {
    id: "new-post",
    kind: "command",
    label: P.newPost,
    keywords: "new post write",
    href: "/dashboard/posts/new",
  },
  { id: "new-idea", kind: "command", label: P.newIdea, keywords: "quick idea" },
  {
    id: "library",
    kind: "command",
    label: P.library,
    keywords: "library home",
    href: "/dashboard",
  },
  { id: "menu", kind: "command", label: P.menu, keywords: "menu", href: "/dashboard/menu" },
  {
    id: "settings",
    kind: "command",
    label: P.settings,
    keywords: "settings",
    href: "/dashboard/settings",
  },
];

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { openIdea } = useAdd();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [remote, setRemote] = useState<PaletteItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loaded = useMemo<PaletteItem[]>(
    () =>
      getPaletteTitles().map((t) => ({
        id: t.id,
        kind: "post",
        label: t.title || bn.library.untitled,
      })),
    [],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // সার্ভার titlePrefix-খোঁজ (বিদ্যমান postRepo.find); ব্যর্থ হলে শুধু লোড-হওয়া তালিকা
  useEffect(() => {
    if (!dq) return;
    let dead = false;
    getPostRepo()
      .then((r) => r.find({ titlePrefix: dq, limit: PALETTE_LIMIT }))
      .then((ps) => {
        if (dead) return;
        setFailed(false);
        setRemote(
          ps.map((p) => ({
            id: p.id,
            kind: "post" as const,
            label: p.title || bn.library.untitled,
          })),
        );
      })
      .catch(() => {
        if (!dead) {
          setFailed(true);
          setRemote([]);
        }
      });
    return () => {
      dead = true;
    };
  }, [dq]);

  const results = useMemo(
    () => matchItems(q, mergePalette(COMMANDS, loaded, dq ? remote : []), PALETTE_LIMIT),
    [q, loaded, remote, dq],
  );
  const idx = results.length === 0 ? -1 : Math.min(cur, results.length - 1);

  function run(it: PaletteItem) {
    onClose();
    if (it.kind === "post") return router.push(`/dashboard/posts/${it.id}/edit`);
    if (it.id === "new-idea") return openIdea();
    const href = COMMANDS.find((c) => c.id === it.id)?.href;
    if (href) router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setCur(moveIndex(idx, e.key === "ArrowDown" ? 1 : -1, results.length));
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      run(results[idx]);
    } else if (e.key === "Tab") {
      e.preventDefault(); // ফোকাস dialog-এর ভেতরেই (একটাই focusable)
      inputRef.current?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={P.title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-xl"
      >
        <input
          ref={inputRef}
          type="text"
          lang="bn"
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={idx >= 0 ? `palette-opt-${idx}` : undefined}
          aria-autocomplete="list"
          value={q}
          placeholder={P.placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setCur(0);
          }}
          className="min-h-12 w-full rounded-t-2xl border-b border-line bg-transparent px-4 text-base text-text outline-none"
        />
        <ul
          id="palette-list"
          role="listbox"
          aria-label={P.results}
          className="max-h-[50vh] overflow-y-auto p-1"
        >
          {results.map((it, i) => (
            <li
              key={`${it.kind}:${it.id}`}
              id={`palette-opt-${i}`}
              role="option"
              aria-selected={i === idx}
              onMouseEnter={() => setCur(i)}
              onClick={() => run(it)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 ${
                i === idx ? "bg-line" : ""
              }`}
            >
              <span className="truncate">{it.label}</span>
              <span className="shrink-0 text-xs text-muted">
                {it.kind === "post" ? P.kindPost : P.kindCommand}
              </span>
            </li>
          ))}
        </ul>
        <p role="status" aria-live="polite" className="px-4 pb-3 text-xs text-muted">
          {results.length === 0 ? P.none : failed ? P.remoteFailed : P.hint}
        </p>
      </div>
    </div>
  );
}
