"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddToggle } from "@/components/ui/AddToggle";
import { ClampText } from "@/components/ui/ClampText";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusCards, type StatusCardOption } from "@/components/ui/StatusCards";
import type { TripWithId } from "@/data/tripRepo";
import { getTripRepo } from "@/data/tripRepo.wire";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { EMPTY_BODY } from "@/lib/editorDoc";
import type { TripStatus } from "@/lib/enums";
import { newId } from "@/lib/id";
import { TRIP_NOTE_MAX, TRIP_PLACE_MAX, formatTaka, parseCost, sortBeen, totalCost } from "@/lib/trips";
import { ConfirmButton } from "../ConfirmButton";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const field = "w-full rounded-xl border border-line bg-surface p-3 text-base";
const dayText = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${bn.diary.months[Number(k.slice(5, 7)) - 1]} ${bnNum(Number(k.slice(0, 4)))}`;
const LABEL: Record<TripStatus, string> = { wish: bn.trips.wish, been: bn.trips.been };

/** ঘোরার তালিকা (দিনলিপি-চ): যেতে চাই/গিয়েছি, নোট, খরচ (পূর্ণসংখ্যা টাকা), ভ্রমণ-লেখা শুরু। শুধু owner */
export function TripView() {
  const tz = useSiteTimezone();
  const router = useRouter();
  const [items, setItems] = useState<TripWithId[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<TripStatus>("wish");
  const [actionErr, setActionErr] = useState(false);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const startingRef = useRef(false);
  const [today] = useState(() => dayKey(Date.now(), tz));

  useEffect(() => {
    let dead = false;
    getTripRepo()
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

  const reload = () => setVersion((v) => v + 1);
  const all = items ?? [];
  const wish = all.filter((t) => t.status === "wish");
  const been = sortBeen(all.filter((t) => t.status === "been"));
  const list = filter === "wish" ? wish : been;
  const options: StatusCardOption<TripStatus>[] = [
    { value: "wish", label: LABEL.wish, count: bnNum(wish.length) },
    { value: "been", label: LABEL.been, count: bnNum(been.length) },
  ];
  const total = totalCost(all);

  async function act(fn: () => Promise<unknown>) {
    setActionErr(false);
    try {
      await fn();
      reload();
    } catch {
      setActionErr(true);
    }
  }

  async function startPost(t: TripWithId) {
    if (startingRef.current) return; // double-tap-এ দুটো খসড়া নয়
    startingRef.current = true;
    setActionErr(false);
    try {
      // ঐ জায়গার ভ্রমণ-খসড়া (স্থান ও শিরোনাম = জায়গার নাম; পরে বদলানো যায়)
      const post = await (await getPostRepo()).create({ id: newId(), title: t.place, body: EMPTY_BODY, contentType: "travel", location: t.place });
      router.push(`/dashboard/posts/${post.id}/edit`);
    } catch {
      setActionErr(true);
      startingRef.current = false;
    }
  }

  return (
    <>
      {total > 0 && <p className="mb-4 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted">💰 {bn.trips.total(formatTaka(total))}</p>}
      <StatusCards label={bn.trips.filterLabel} value={filter} options={options} onChange={setFilter} />
      <div className="mt-4">
        {adding ? (
          <TripForm status={filter} today={today} onAdded={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
        ) : (
          <AddToggle label={bn.trips.addTitle} onClick={() => setAdding(true)} />
        )}
      </div>
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.trips.loadFailed}</p>}
      {actionErr && <p role="alert" className="mt-4 text-accent-text">{bn.trips.actionFailed}</p>}
      {items !== undefined && list.length === 0 && !failed && <EmptyState icon="globe" text={bn.trips.empty} />}
      <ul className="mt-4 space-y-4">
        {list.map((t) => (
          <li key={t.id} className="rounded-2xl border border-line border-l-4 border-l-btn-bg bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-line text-2xl">
                📍
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-serif text-xl font-bold leading-snug">{t.place}</p>
                {(t.status === "been" && t.day) || t.costTaka !== undefined ? (
                  <p className="text-sm text-muted">
                    {t.status === "been" && t.day && dayText(t.day)}
                    {t.status === "been" && t.day && t.costTaka !== undefined && " · "}
                    {t.costTaka !== undefined && formatTaka(t.costTaka)}
                  </p>
                ) : null}
              </div>
            </div>
            {t.note && editFor !== t.id && <ClampText text={t.note} more={bn.ideas.more} less={bn.ideas.less} className="mt-3 font-serif text-base" />}
            {editFor === t.id && <TripEditor trip={t} onDone={() => { setEditFor(null); reload(); }} />}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {t.status === "wish" ? (
                <Btn primary label={bn.trips.markBeen} onClick={() => void act(async () => (await getTripRepo()).update(t.id, { status: "been", day: today }))} />
              ) : (
                <>
                  <Btn primary label={bn.trips.startPost} onClick={() => void startPost(t)} />
                  <Btn label={bn.trips.backToWish} onClick={() => void act(async () => (await getTripRepo()).update(t.id, { status: "wish" }))} />
                </>
              )}
              <Btn label={bn.trips.editBtn} onClick={() => setEditFor(editFor === t.id ? null : t.id)} />
              <ConfirmButton
                label={bn.trips.remove}
                question={bn.trips.removeQ}
                onConfirm={() => void act(async () => (await getTripRepo()).delete(t.id))}
                className="min-h-11 rounded-full border border-line px-4 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Btn({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-11 rounded-full px-4 text-sm ${primary ? "bg-btn-bg text-btn-tx" : "border border-line"}`}>
      {label}
    </button>
  );
}

function TripEditor({ trip, onDone }: { trip: TripWithId; onDone: () => void }) {
  const [note, setNote] = useState(trip.note);
  const [cost, setCost] = useState(trip.costTaka === undefined ? "" : String(trip.costTaka));
  const [day, setDay] = useState(trip.day ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (busy) return;
    const c = parseCost(cost);
    if (!c.ok) {
      setErr(bn.trips.costInvalid);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await (await getTripRepo()).update(trip.id, { note, costTaka: c.value ?? null, ...(day ? { day } : {}) });
      onDone();
    } catch {
      setErr(bn.trips.saveFailed);
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 space-y-3">
      <label className="block text-sm">
        {bn.trips.costLabel}
        <input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} className={`${field} mt-1`} />
      </label>
      {trip.status === "been" && (
        <label className="block text-sm">
          {bn.trips.dayLabel}
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${field} mt-1`} />
        </label>
      )}
      <label className="block text-sm">
        {bn.trips.noteLabel}
        <textarea value={note} maxLength={TRIP_NOTE_MAX} rows={4} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      {err && <p role="alert" className="text-accent-text">{err}</p>}
      <button type="button" onClick={() => void save()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx aria-disabled:opacity-60">
        {bn.trips.save}
      </button>
    </div>
  );
}

function TripForm({ status, today, onAdded, onCancel }: { status: TripStatus; today: string; onAdded: () => void; onCancel: () => void }) {
  const [place, setPlace] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef<string>("");

  async function submit() {
    if (busy) return;
    if (!place.trim()) {
      setErr(bn.trips.placeRequired);
      return;
    }
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate হয় না
    setBusy(true);
    setErr(null);
    try {
      await (await getTripRepo()).create({ id: idRef.current, place, note: detail, status, ...(status === "been" ? { day: today } : {}) });
      idRef.current = "";
      setPlace("");
      setDetail("");
      onAdded();
    } catch {
      setErr(bn.trips.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.trips.addTitle} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm text-muted">🧭 {bn.trips.addTitle}</h2>
      <label className="mb-3 block text-sm">
        {bn.trips.placeLabel}
        <input value={place} maxLength={TRIP_PLACE_MAX} onChange={(e) => setPlace(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.trips.detailLabel}
        <textarea value={detail} maxLength={TRIP_NOTE_MAX} rows={3} onChange={(e) => setDetail(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      <p className="mb-3 text-sm text-muted">{bn.trips.addsTo(LABEL[status])}</p>
      {err && <p role="alert" className="mb-3 text-accent-text">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void submit()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx aria-disabled:opacity-60">
          {busy ? bn.trips.adding : bn.trips.add}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-line px-5">
          {bn.ideas.cancel}
        </button>
      </div>
    </section>
  );
}
