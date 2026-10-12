"use client";

// Publish panel-এর 'কভার ছবি' (P6-৩ক): শুধু পাবলিক ছবি বাছা যায়; state parent-এ (PublishPanel), সেভে `coverMediaId` patch।
import { useEffect, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  /** লেখা বদলানো (P9b-২: লোগো/ব্যানারেও একই picker); না দিলে আগের মতো 'কভার ছবি' */
  labels?: { [K in keyof typeof bn.publishPanel.cover]?: string };
  /** প্রিভিউর আকার (ধাপ খ): লোগো = বর্গ, ব্যানার = ৩:১; না দিলে আগের মতো */
  shape?: "default" | "square" | "banner";
};
const SHAPE = {
  default: "h-16 w-28",
  square: "size-16",
  banner: "aspect-[3/1] w-40",
} as const;
type Cur = { id: string; m: MediaWithId | null };

const btn = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";

const thumb = (m: MediaWithId): string | null => {
  const cloud = cloudFromUrl(m.cloudinaryUrl);
  return cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 320 }) : null;
};

export function CoverPicker({ value, onChange, disabled, labels, shape = "default" }: Props) {
  const t = { ...bn.publishPanel.cover, ...labels };
  const [cur, setCur] = useState<Cur | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaWithId[] | null>(null);
  const [next, setNext] = useState<Date | undefined>();
  const [err, setErr] = useState(false);

  // বর্তমান cover-এর মেটা (মোছা হলে m = null ⇒ 'পাওয়া যায়নি')
  useEffect(() => {
    if (!value) return;
    let dead = false;
    (async () => {
      try {
        const m = await (await getMediaRepo()).get(value);
        if (!dead) setCur({ id: value, m });
      } catch {
        if (!dead) setCur({ id: value, m: null });
      }
    })();
    return () => {
      dead = true;
    };
  }, [value]);

  async function load(after?: Date) {
    setErr(false);
    try {
      const p = await (await getMediaRepo()).list({ type: "image", after });
      const pub = p.items.filter((m) => m.visibility === "public" && thumb(m));
      setItems((a) => (after && a ? [...a, ...pub] : pub));
      setNext(p.next);
    } catch {
      setErr(true);
    }
  }

  function toggle() {
    const o = !open;
    setOpen(o);
    if (o && items === null) void load();
  }

  const shown = value && cur?.id === value ? cur.m : undefined; // undefined = লোড হচ্ছে, null = পাওয়া যায়নি
  const src = shown ? thumb(shown) : null;

  return (
    <fieldset className="space-y-3 border-t border-line pt-4" disabled={disabled}>
      <legend className="font-serif text-lg font-bold">{t.title}</legend>

      {value ? (
        <div className="flex items-center gap-3">
          <div className={`flex ${SHAPE[shape]} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-line text-xl`}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={shown?.altText || shown?.fileName || ""} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>🖼️</span>
            )}
          </div>
          <p className="min-w-0 flex-1 break-all text-sm text-muted">{shown === null ? t.missing : (shown?.fileName ?? t.loading)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t.none}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} aria-expanded={open} onClick={toggle}>
          {open ? t.close : value ? t.change : t.choose}
        </button>
        {value && (
          <button type="button" className={btn} onClick={() => onChange(null)}>
            {t.remove}
          </button>
        )}
      </div>

      {open && (
        <div>
          {err && (
            <p role="alert" className="text-sm text-accent-text">
              {t.error}{" "}
              <button type="button" className="min-h-11 underline" onClick={() => load()}>
                {bn.media.retry}
              </button>
            </p>
          )}
          {items === null && !err && <p className="text-sm text-muted">{t.loading}</p>}
          {items?.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}
          <ul className="grid grid-cols-3 gap-2">
            {items?.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={m.id === value}
                  aria-label={m.altText || m.fileName}
                  onClick={() => {
                    setCur({ id: m.id, m });
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`block aspect-square w-full overflow-hidden rounded-xl border-2 ${m.id === value ? "border-accent" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(m) ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {next && (
            <button type="button" className={`${btn} mt-2`} onClick={() => load(next)}>
              {bn.media.more}
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-muted">{t.hint}</p>
    </fieldset>
  );
}
