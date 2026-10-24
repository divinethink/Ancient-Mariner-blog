"use client";

// ⊕ bottom-sheet (mobile) / modal (desktop) — Mockup §২.২, §৩ `QuickCaptureSheet`। P3b: নতুন লেখা · Quick Idea।
// Quick Idea: id আগে বানানো (create idempotent — double-tap/retry-তে duplicate নয়); সংরক্ষণ ব্যর্থ হলে লেখা থেকে যায়;
// sheet বন্ধ করলেও অসংরক্ষিত লেখা provider-এ থাকে (আবার খুললে ফেরে)।
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey, formatDate } from "@/lib/datetime";
import { DIARY_TEXT_MAX, isValidDayKey, textToDoc } from "@/lib/diary";
import { promptFor } from "@/lib/diaryPrompts";
import { WriteTimer } from "./WriteTimer";
import { MAX_LOCATION } from "@/data/postRepo";
import { countWords, docToText, makeExcerpt, serializeDoc } from "@/lib/editorDoc";
import { newId } from "@/lib/id";
import { IDEA_TEXT_MAX } from "@/lib/idea";
import { useSiteTimezone } from "./SiteSettingsProvider";
import { TemplatePicker } from "./TemplatePicker";

type Mode = "closed" | "menu" | "idea" | "diary" | "templates";
type Status = "idle" | "saving" | "failed" | "invalid" | "badDay";
type AddCtx = {
  openMenu: () => void;
  openIdea: () => void;
  openDiary: () => void;
  /** আইডিয়া সংরক্ষণ হলে বাড়ে — আইডিয়া-তালিকা এটা দেখে নতুন করে আনে */
  ideasVersion: number;
  /** diary entry সংরক্ষণ হলে বাড়ে — দিনলিপি-পেজ/'এই দিনে' এটা দেখে নতুন করে আনে */
  diaryVersion: number;
};

const Ctx = createContext<AddCtx>({
  openMenu: () => undefined,
  openIdea: () => undefined,
  openDiary: () => undefined,
  ideasVersion: 0,
  diaryVersion: 0,
});
export const useAdd = (): AddCtx => useContext(Ctx);

const FOCUSABLE =
  "a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])";
const row =
  "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left text-base hover:bg-line";

export function AddProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const tz = useSiteTimezone();
  const [mode, setMode] = useState<Mode>("closed");
  const [text, setText] = useState("");
  const [diaryText, setDiaryText] = useState("");
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diaryPlace, setDiaryPlace] = useState("");
  const [diaryDay, setDiaryDay] = useState(""); // খালি = আজ
  const [promptShift, setPromptShift] = useState(0); // 'অন্য প্রশ্ন'; sheet খুললে ০
  const [todayKey, setTodayKey] = useState(""); // sheet খোলার সময় বসে (render-এ Date.now() নয়)
  const [diaryVersion, setDiaryVersion] = useState(0);
  const diaryIdRef = useRef<string>("");
  const diaryTextRef = useRef("");
  const [status, setStatus] = useState<Status>("idle");
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<false | "idea" | "diary">(false);
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
    if (diaryIdRef.current === "") diaryIdRef.current = newId();
    setStatus("idle");
    setTodayKey(dayKey(Date.now(), tz));
    setPromptShift(0);
    setMode(m);
  }, [tz]);
  const openMenu = useCallback(() => open("menu"), [open]);
  const openIdea = useCallback(() => open("idea"), [open]);
  const openDiary = useCallback(() => open("diary"), [open]);
  const close = useCallback(() => {
    setMode("closed");
    triggerRef.current?.focus();
  }, []);

  // খোলার পর ফোকাস: আইডিয়া-ফর্মে textarea, নইলে প্রথম বোতাম
  useEffect(() => {
    if (mode === "idea" || mode === "diary") areaRef.current?.focus();
    else if (mode === "menu" || mode === "templates") dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
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
      setToast("idea");
      close();
    } catch {
      setStatus("failed");
    } finally {
      savingRef.current = false;
    }
  }

  // Quick Diary Entry (P8a-১): diary · Private · Draft · শিরোনাম = আজকের তারিখ · date = আজ।
  // id আগে বানানো ⇒ double-tap/retry-তে create idempotent (postRepo.create বিদ্যমান id ফেরত দেয়)।
  async function saveDiary() {
    if (savingRef.current) return;
    const trimmed = diaryText.trim();
    if (trimmed === "" || trimmed.length > DIARY_TEXT_MAX) {
      setStatus("invalid");
      return;
    }
    const today = dayKey(Date.now(), tz);
    const day = diaryDay === "" ? today : diaryDay;
    if (!isValidDayKey(day) || day > today) {
      setStatus("badDay");
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    const sent = diaryText;
    try {
      const doc = textToDoc(trimmed);
      const plain = docToText(doc);
      const repo = await getPostRepo();
      const place = diaryPlace.trim();
      await repo.create({
        id: diaryIdRef.current,
        title: diaryTitle.trim() || formatDate(new Date(`${day}T12:00:00Z`), "UTC"),
        body: serializeDoc(doc),
        excerpt: makeExcerpt(plain),
        wordCount: countWords(plain),
        visibility: "private",
        contentType: "diary",
        date: day,
        ...(place && { location: place }),
      });
      if (diaryTextRef.current === sent) {
        diaryIdRef.current = newId();
        diaryTextRef.current = "";
        setDiaryText("");
        setDiaryTitle("");
        setDiaryPlace("");
        setDiaryDay("");
      }
      setDiaryVersion((v) => v + 1);
      setStatus("idle");
      setToast("diary");
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
    () => ({ openMenu, openIdea, openDiary, ideasVersion: version, diaryVersion }),
    [openMenu, openIdea, openDiary, version, diaryVersion],
  );
  const t = bn.ideas;
  const d = bn.diary;
  const isDiary = mode === "diary";
  const curText = isDiary ? diaryText : text;
  const curMax = isDiary ? DIARY_TEXT_MAX : IDEA_TEXT_MAX;
  const msg =
    status === "saving"
      ? t.saving
      : status === "failed"
        ? isDiary
          ? d.saveFailed
          : t.saveFailed
        : status === "badDay"
          ? d.badDay
          : status === "invalid"
          ? isDiary
            ? d.invalid
            : t.invalid
          : "";

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-btn-bg px-4 py-2 text-sm text-btn-tx shadow-lg"
        >
          {toast === "diary" ? d.saved : t.saved}
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
                {mode === "idea" ? t.quickTitle : mode === "diary" ? d.quickTitle : mode === "templates" ? t.templatesTitle : t.sheetTitle}
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
                <Link href="/dashboard/projects?pick=1" onClick={() => setMode("closed")} className={row}>
                  <span aria-hidden>📖</span>
                  {t.newChapter}
                </Link>
                <button type="button" onClick={() => setMode("templates")} className={row}>
                  <span aria-hidden>📄</span>
                  <span className="flex flex-col">
                    {t.fromTemplate}
                    <span className="text-xs font-normal text-muted">{t.fromTemplateHint}</span>
                  </span>
                </button>
                <button type="button" onClick={() => setMode("idea")} className={row}>
                  <span aria-hidden>💡</span>
                  {t.quickTitle}
                </button>
              </div>
            ) : mode === "templates" ? (
              <TemplatePicker
                onBack={() => setMode("menu")}
                onPick={(ref) => {
                  setMode("closed");
                  router.push(`/dashboard/posts/${newId()}/edit?new=1&tpl=${encodeURIComponent(ref)}`);
                }}
              />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void (isDiary ? saveDiary() : save());
                }}
              >
                <label htmlFor="quick-idea-text" className="sr-only">
                  {isDiary ? d.quickLabel : t.quickLabel}
                </label>
                {isDiary && (
                  <div className="mb-2 space-y-2">
                    <input
                      type="text"
                      aria-label={d.fieldTitle}
                      placeholder={d.fieldTitle}
                      maxLength={120}
                      value={diaryTitle}
                      onChange={(e) => setDiaryTitle(e.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base field-clean font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        aria-label={d.fieldPlace}
                        placeholder={d.fieldPlace}
                        maxLength={MAX_LOCATION}
                        value={diaryPlace}
                        onChange={(e) => setDiaryPlace(e.target.value)}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base field-clean"
                      />
                      <input
                        type="date"
                        aria-label={d.labelDay}
                        max={todayKey || undefined}
                        value={diaryDay || todayKey}
                        onChange={(e) => {
                          setDiaryDay(e.target.value);
                          if (status !== "saving") setStatus("idle");
                        }}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base field-clean text-text"
                      />
                    </div>
                  </div>
                )}
                {isDiary && (
                  <div className="mb-2 flex flex-wrap items-center gap-x-2">
                    <p className="min-w-0 flex-1 font-serif text-base">
                      <span className="sr-only">{d.promptLabel}: </span>
                      {promptFor(todayKey, promptShift)}
                    </p>
                    <button type="button" onClick={() => setPromptShift((n) => n + 1)} className="min-h-11 rounded-full px-3 text-sm text-accent-text underline">
                      {d.promptOther}
                    </button>
                    <WriteTimer />
                  </div>
                )}
                <textarea
                  id="quick-idea-text"
                  ref={areaRef}
                  rows={isDiary ? 7 : 5}
                  maxLength={curMax}
                  value={curText}
                  placeholder={isDiary ? d.quickPlaceholder : t.quickPlaceholder}
                  onChange={(e) => {
                    if (isDiary) {
                      diaryTextRef.current = e.target.value;
                      setDiaryText(e.target.value);
                    } else {
                      textRef.current = e.target.value;
                      setText(e.target.value);
                    }
                    if (status !== "saving") setStatus("idle");
                  }}
                  className="field-clean w-full rounded-lg border border-line bg-surface p-3 text-base"
                />
                <div className="mt-1 flex min-h-6 items-center justify-between text-sm">
                  <p
                    role="status"
                    aria-live="polite"
                    className={
                      status === "failed" || status === "invalid" || status === "badDay"
                        ? "text-accent-text"
                        : "text-muted"
                    }
                  >
                    {msg}
                  </p>
                  {curText.length >= curMax * 0.9 && (
                    <span className="text-muted">{t.counter(curText.length, curMax)}</span>
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
