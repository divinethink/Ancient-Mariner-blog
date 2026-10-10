"use client";

// Publish panel-এর 'গ্যালারি' (P8a-২): শুধু পাবলিক ছবি, ≤২০, ক্রম বদলানো যায়; state parent-এ (PublishPanel), সেভে `gallery` patch।
// CoverPicker-এর মতোই media-তালিকা (পাবলিক ছবি) reuse; নির্বাচিতের মেটা আলাদা get (মোছা হলে 'পাওয়া যায়নি')।
import { useEffect, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";
import { MAX_GALLERY_ITEMS, moveId, toggleId } from "@/lib/gallery";

type Props = { value: string[]; onChange: (ids: string[]) => void; disabled: boolean };
type Meta = MediaWithId | null; // null = পাওয়া যায়নি

const btn = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const small = "flex size-11 items-center justify-center rounded-full border border-line disabled:opacity-40";

const thumb = (m: MediaWithId): string | null => {
  const cloud = cloudFromUrl(m.cloudinaryUrl);
  return cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 320 }) : null;
};

export function GalleryPicker({ value, onChange, disabled }: Props) {
  const t = bn.publishPanel.gallery;
  const [metas, setMetas] = useState<Record<string, Meta>>({});
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaWithId[] | null>(null);
  const [next, setNext] = useState<Date | undefined>();
  const [err, setErr] = useState(false);

  // নির্বাচিতদের মেটা (এখনো-না-আনা id-গুলো)
  useEffect(() => {
    const need = value.filter((id) => !(id in metas));
    if (need.length === 0) return;
    let dead = false;
    (async () => {
      const repo = await getMediaRepo().catch(() => null);
      const got = await Promise.all(need.map((id) => (repo ? repo.get(id).catch(() => null) : Promise.resolve(null))));
      if (!dead) setMetas((m) => ({ ...m, ...Object.fromEntries(need.map((id, i) => [id, got[i]])) }));
    })();
    return () => {
      dead = true;
    };
  }, [value, metas]);

  async function load(after?: Date) {
    setErr(false);
    try {
      const p = await (await getMediaRepo()).list({ type: "image", after });
      const pub = p.items.filter((m) => m.visibility === "public" && thumb(m));
      setItems((a) => (after && a ? [...a, ...pub] : pub));
      setNext(p.next);
      setMetas((m) => ({ ...Object.fromEntries(pub.map((x) => [x.id, x])), ...m }));
    } catch {
      setErr(true);
    }
  }

  const full = value.length >= MAX_GALLERY_ITEMS;

  return (
    <fieldset className="space-y-3 border-t border-line pt-4" disabled={disabled}>
      <legend className="font-serif text-lg font-bold">{t.title}</legend>

      {value.length === 0 ? (
        <p className="text-sm text-muted">{t.none}</p>
      ) : (
        <ul className="space-y-2">
          {value.map((id, i) => {
            const m = metas[id];
            const src = m ? thumb(m) : null;
            return (
              <li key={id} className="flex items-center gap-2">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-line">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={m?.altText || m?.fileName || ""} className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden>🖼️</span>
                  )}
                </div>
                <p className="min-w-0 flex-1 break-all text-sm text-muted">{m === null ? t.missing : (m?.fileName ?? t.loading)}</p>
                <button type="button" className={small} aria-label={t.up} disabled={i === 0} onClick={() => onChange(moveId(value, i, -1))}>
                  ↑
                </button>
                <button type="button" className={small} aria-label={t.down} disabled={i === value.length - 1} onClick={() => onChange(moveId(value, i, 1))}>
                  ↓
                </button>
                <button type="button" className={small} aria-label={t.remove} onClick={() => onChange(toggleId(value, id))}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btn}
          aria-expanded={open}
          onClick={() => {
            const o = !open;
            setOpen(o);
            if (o && items === null) void load();
          }}
        >
          {open ? t.close : t.choose}
        </button>
        <span className="text-sm text-muted">{full ? t.full : t.count(value.length, MAX_GALLERY_ITEMS)}</span>
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
            {items?.map((m) => {
              const on = value.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={m.altText || m.fileName}
                    disabled={!on && full}
                    onClick={() => onChange(toggleId(value, m.id))}
                    className={`relative block aspect-square w-full overflow-hidden rounded-xl border-2 disabled:opacity-40 ${on ? "border-accent" : "border-line"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(m) ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {on && (
                      <span aria-hidden className="absolute right-1 top-1 rounded-full bg-btn-bg px-2 text-xs text-btn-tx">
                        {value.indexOf(m.id) + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
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
