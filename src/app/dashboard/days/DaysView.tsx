"use client";

import { useEffect, useRef, useState } from "react";
import type { SpecialDayWithId } from "@/data/specialDayRepo";
import { getSpecialDayRepo } from "@/data/specialDayRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { SPECIAL_DAY_KIND, type SpecialDayKind } from "@/lib/enums";
import { newId } from "@/lib/id";
import { AddToggle } from "@/components/ui/AddToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { SPECIAL_NAME_MAX, SPECIAL_YEAR_MAX, SPECIAL_YEAR_MIN, sortUpcoming, validMonthDay, yearsAt } from "@/lib/specialDays";
import { ConfirmButton } from "../ConfirmButton";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const field = "w-full rounded-xl border border-line bg-surface p-3 text-base";
const KIND_EMOJI: Record<string, string> = { birthday: "🎂", anniversary: "💍", other: "⭐" };

/** বিশেষ দিন (দিনলিপি-চ): জন্মদিন/বার্ষিকী — প্রতি বছর একই মাস-দিনে ফেরে; আসন্ন ক্রমে। শুধু owner */
export function DaysView() {
  const tz = useSiteTimezone();
  const [items, setItems] = useState<SpecialDayWithId[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [actionErr, setActionErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [today] = useState(() => dayKey(Date.now(), tz));

  useEffect(() => {
    let dead = false;
    getSpecialDayRepo()
      .then((r) => r.list())
      .then((l) => {
        if (dead) return;
        setItems(l);
        setFailed(false);
      })
      .catch(() => {
        if (dead) return;
        setFailed(true);
        setItems((p) => p ?? []);
      });
    return () => {
      dead = true;
    };
  }, [version]);

  async function remove(id: string) {
    setActionErr(false);
    try {
      await (await getSpecialDayRepo()).delete(id);
      setVersion((v) => v + 1);
    } catch {
      setActionErr(true);
    }
  }

  const sorted = sortUpcoming(items ?? [], today);
  return (
    <>
      {adding ? (
        <DayForm onAdded={() => { setAdding(false); setVersion((v) => v + 1); }} onCancel={() => setAdding(false)} />
      ) : (
        <AddToggle label={bn.days.addTitle} onClick={() => setAdding(true)} />
      )}
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.days.loadFailed}</p>}
      {actionErr && <p role="alert" className="mt-4 text-accent-text">{bn.days.actionFailed}</p>}
      {items !== undefined && sorted.length === 0 && !failed && <div className="mt-6"><EmptyState icon="calendar" text={bn.days.empty} /></div>}
      <ul className="mt-6 space-y-4">
        {sorted.map((d) => {
          const n = yearsAt(d.next, d.year);
          return (
            <li key={d.id} className="rounded-2xl border border-line border-l-4 border-l-btn-bg bg-surface p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-line text-2xl">
                  {KIND_EMOJI[d.kind] ?? "⭐"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-serif text-xl font-bold leading-snug">{d.name}</p>
                  <p className="text-sm text-muted">
                    {bn.days.kinds[d.kind]} · {bnNum(d.day)} {bn.diary.months[d.month - 1]}
                    {n !== undefined && ` · ${bn.days.years(bnNum(n))}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${d.inDays === 0 ? "bg-btn-bg text-btn-tx" : "border border-line text-accent-text"}`}>
                  {d.inDays === 0 ? bn.days.today : bn.days.inDays(bnNum(d.inDays))}
                </span>
              </div>
              <ConfirmButton
                label={bn.days.remove}
                question={bn.days.removeQ}
                onConfirm={() => void remove(d.id)}
                className="mt-3 min-h-11 rounded-full border border-line px-4 text-sm"
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DayForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SpecialDayKind>("birthday");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef<string>("");

  async function submit() {
    if (busy) return;
    if (!name.trim()) return setErr(bn.days.nameRequired);
    const d = Number(day.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c))));
    if (!validMonthDay(month, d)) return setErr(bn.days.dayInvalid);
    let y: number | undefined;
    if (year.trim() !== "") {
      y = Number(year.trim().replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c))));
      if (!Number.isInteger(y) || y < SPECIAL_YEAR_MIN || y > SPECIAL_YEAR_MAX) return setErr(bn.days.yearInvalid);
    }
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate হয় না
    setBusy(true);
    setErr(null);
    try {
      await (await getSpecialDayRepo()).create({ id: idRef.current, name, kind, month, day: d, ...(y !== undefined ? { year: y } : {}) });
      idRef.current = "";
      setName("");
      setDay("");
      setYear("");
      onAdded();
    } catch {
      setErr(bn.days.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.days.addTitle} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm text-muted">🎂 {bn.days.addTitle}</h2>
      <label className="mb-3 block text-sm">
        {bn.days.nameLabel}
        <input value={name} maxLength={SPECIAL_NAME_MAX} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.days.kindLabel}
        <select value={kind} onChange={(e) => setKind(e.target.value as SpecialDayKind)} className={`${field} mt-1`}>
          {SPECIAL_DAY_KIND.map((k) => (
            <option key={k} value={k}>
              {bn.days.kinds[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block text-sm">
          {bn.days.monthLabel}
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${field} mt-1`}>
            {bn.diary.months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {bn.days.dayLabel}
          <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <label className="mb-3 block text-sm">
        {bn.days.yearLabel}
        <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} className={`${field} mt-1`} />
      </label>
      {err && <p role="alert" className="mb-3 text-accent-text">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void submit()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx aria-disabled:opacity-60">
          {busy ? bn.days.adding : bn.days.add}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-line px-5">
          {bn.ideas.cancel}
        </button>
      </div>
    </section>
  );
}
