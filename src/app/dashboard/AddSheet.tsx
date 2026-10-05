"use client";

// ⊕ bottom-sheet (mobile) / modal (desktop) — Mockup §২.২, §৩ `QuickCaptureSheet`। P3b: নতুন লেখা · Quick Idea।
// Quick Idea: id আগে বানানো (create idempotent — double-tap/retry-তে duplicate নয়); সংরক্ষণ ব্যর্থ হলে লেখা থেকে যায়;
// sheet বন্ধ করলেও অসংরক্ষিত লেখা provider-এ থাকে (আবার খুললে ফেরে)।
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IdeaTextSchema } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { bn } from "@/i18n/bn";
import { newId } from "@/lib/id";
import { IDEA_TEXT_MAX } from "@/lib/idea";

type Mode = "closed" | "menu" | "idea";
type Status = "idle" | "saving" | "failed" | "invalid";
type AddCtx = {
  openMenu: () => void;
  openIdea: () => void;
  /** আইডিয়া সংরক্ষণ হলে বাড়ে — আইডিয়া-তালিকা এটা দেখে নতুন করে আনে */
  ideasVersion: number;
};

const Ctx = createContext<AddCtx>({
  openMenu: () => undefined,
  openIdea: () => undefined,
  ideasVersion: 0,
});
export const useAdd = (): AddCtx => useContext(Ctx);

const FOCUSABLE =
  "a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])";
const row =
  "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left text-base hover:bg-line";

export function AddProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("closed");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(false);
  const idRef = useRef<string>("");
  const textRef = useRef("");
  const savingRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const open = useCallback((m: Exclude<Mode, "closed">) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (idRef.current === "") idRef.current = newId();
    setStatus("idle");
    setMode(m);
  }, []);
  const openMenu = useCallback(() => open("menu"), [open]);
  const openIdea = useCallback(() => open("idea"), [open]);
  const close = useCallback(() => {
    setMode("closed");
    triggerRef.current?.focus();
  }, []);

  // খোলার পর ফোকাস: আইডিয়া-ফর্মে textarea, নইলে প্রথম বোতাম
  useEffect(() => {
    if (mode === "idea") areaRef.current?.focus();
    else if (mode === "menu") dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [mode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function save() {
    if (savingRef.current) return; // double-submit গার্ড
    const parsed = IdeaTextSchema.safeParse(text);
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    const sent = text;
    try {
      const repo = await getIdeaRepo();
      await repo.create({ id: idRef.current, text: parsed.data });
      // সংরক্ষণ চলাকালে নতুন কিছু টাইপ হয়ে থাকলে তা মোছা হয় না
      if (textRef.current === sent) {
        idRef.current = newId();
        textRef.current = "";
        setText("");
      }
      setVersion((v) => v + 1);
      setStatus("idle");
      setToast(true);
      close();
    } catch {
      setStatus("failed");
    } finally {
      savingRef.current = false;
    }
  }

  // Esc ও Tab-trap document-স্তরে: ফোকাস body-তে চলে গেলেও (যেমন বোতাম disabled হলে) কাজ করে
  useEffect(() => {
    if (mode === "closed") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = dialogRef.current?.contains(active) ?? false;
      if (!inside || (e.shiftKey && active === first)) {
        e.preventDefault();
        (e.shiftKey && inside ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, close]);

  const value = useMemo(
    () => ({ openMenu, openIdea, ideasVersion: version }),
    [openMenu, openIdea, version],
  );
  const t = bn.ideas;
  const msg =
    status === "saving"
      ? t.saving
      : status === "failed"
        ? t.saveFailed
        : status === "invalid"
          ? t.invalid
          : "";

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-btn-bg px-4 py-2 text-sm text-btn-tx shadow-lg"
        >
          {t.saved}
        </p>
      )}
      {mode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <button
            type="button"
            aria-label={t.close}
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-sheet-title"
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl md:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="add-sheet-title" className="font-serif text-xl font-bold">
                {mode === "idea" ? t.quickTitle : t.sheetTitle}
              </h2>
              <button
                type="button"
                aria-label={t.close}
                onClick={close}
                className="flex size-11 items-center justify-center rounded-full text-xl text-muted hover:bg-line"
              >
                ✕
              </button>
            </div>

            {mode === "menu" ? (
              <div className="space-y-2">
                <Link href="/dashboard/posts/new" onClick={() => setMode("closed")} className={row}>
                  <span aria-hidden>✏️</span>
                  {t.newPost}
                </Link>
                <button type="button" onClick={() => setMode("idea")} className={row}>
                  <span aria-hidden>💡</span>
                  {t.quickTitle}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <label htmlFor="quick-idea-text" className="sr-only">
                  {t.quickLabel}
                </label>
                <textarea
                  id="quick-idea-text"
                  ref={areaRef}
                  rows={5}
                  maxLength={IDEA_TEXT_MAX}
                  value={text}
                  placeholder={t.quickPlaceholder}
                  onChange={(e) => {
                    textRef.current = e.target.value;
                    setText(e.target.value);
                    if (status !== "saving") setStatus("idle");
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-3 text-base"
                />
                <div className="mt-1 flex min-h-6 items-center justify-between text-sm">
                  <p
                    role="status"
                    aria-live="polite"
                    className={
                      status === "failed" || status === "invalid"
                        ? "text-accent-text"
                        : "text-muted"
                    }
                  >
                    {msg}
                  </p>
                  {text.length >= IDEA_TEXT_MAX * 0.9 && (
                    <span className="text-muted">{t.counter(text.length, IDEA_TEXT_MAX)}</span>
                  )}
                </div>
                <button
                  type="submit"
                  aria-disabled={status === "saving"}
                  className="mt-3 min-h-12 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx aria-disabled:opacity-50"
                >
                  {status === "saving" ? t.saving : t.save}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
