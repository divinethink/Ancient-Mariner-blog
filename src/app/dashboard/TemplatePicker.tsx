"use client";

// ⊕-sheet-এর 'ছাঁচ থেকে শুরু' (P7b-২): তৈরি চারটি (কোডে) + নিজের সেভ-করা (`templates`, lazy-load)।
import { useEffect, useMemo, useRef, useState } from "react";
import { getTemplateRepo } from "@/data/templateRepo.wire";
import type { TemplateWithId } from "@/data/templateRepo";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { builtinTemplates } from "@/lib/templates";
import { useSiteTimezone } from "./SiteSettingsProvider";

const t = bn.ideas;
const row =
  "flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line px-4 text-left text-base hover:bg-line";

export function TemplatePicker({
  onPick,
  onBack,
}: {
  onPick: (ref: string) => void;
  onBack: () => void;
}) {
  const tz = useSiteTimezone();
  const builtins = useMemo(() => builtinTemplates(formatDate(new Date(), tz)), [tz]);
  const [mine, setMine] = useState<TemplateWithId[] | null | "failed">(null);
  const [err, setErr] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let dead = false;
    getTemplateRepo()
      .then((r) => r.list())
      .then((x) => !dead && setMine(x))
      .catch(() => !dead && setMine("failed"));
    return () => {
      dead = true;
    };
  }, []);

  async function remove(x: TemplateWithId) {
    if (busy.current || !window.confirm(t.templateDeleteConfirm(x.name))) return;
    busy.current = true;
    setErr(false);
    try {
      await (await getTemplateRepo()).delete(x.id);
      setMine((cur) => (Array.isArray(cur) ? cur.filter((y) => y.id !== x.id) : cur));
    } catch {
      setErr(true);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="max-h-[60vh] space-y-2 overflow-y-auto">
      <button type="button" onClick={onBack} className="min-h-11 text-sm text-muted underline">
        {t.templatesBack}
      </button>
      <h3 className="text-sm text-muted">{t.templatesBuiltin}</h3>
      {builtins.map((b) => (
        <button key={b.ref} type="button" onClick={() => onPick(b.ref)} className={row}>
          {b.name}
        </button>
      ))}
      <h3 className="pt-2 text-sm text-muted">{t.templatesMine}</h3>
      {mine === null && (
        <p role="status" className="text-sm text-muted">
          {t.templatesLoading}
        </p>
      )}
      {mine === "failed" && (
        <p role="alert" className="text-sm text-accent-text">
          {t.templatesFailed}
        </p>
      )}
      {Array.isArray(mine) && mine.length === 0 && (
        <p className="text-sm text-muted">{t.templatesNone}</p>
      )}
      {Array.isArray(mine) &&
        mine.map((x) => (
          <div key={x.id} className="flex items-center gap-1">
            <button type="button" onClick={() => onPick(`u:${x.id}`)} className={row}>
              <span className="truncate">{x.name || bn.library.untitled}</span>
            </button>
            <button
              type="button"
              aria-label={t.templateDelete(x.name)}
              onClick={() => void remove(x)}
              className="min-h-11 min-w-11 shrink-0 rounded-full text-lg text-muted hover:bg-line"
            >
              🗑
            </button>
          </div>
        ))}
      {err && (
        <p role="alert" className="text-sm text-accent-text">
          {t.templateDeleteFailed}
        </p>
      )}
    </div>
  );
}
