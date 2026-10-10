"use client";

// সাইট সাজান (P9a-২): মেনু ও footer সম্পাদনা। সেভ = একটাই `siteSettings` write (সর্বশেষ মান আবার পড়ে শুধু menu/footer বদলায় —
// Settings-ফর্মের অন্য ফিল্ড মুছে যায় না), তারপর rebuild। ক্রম-বদল ↑↓ বোতামে (অনুমোদিত সিদ্ধান্ত: @dnd-kit নয়)।
import { useEffect, useMemo, useState } from "react";
import type { PageWithId } from "@/data/pageRepo";
import { getPageRepo } from "@/data/pageRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import type { TermWithId } from "@/data/taxonomyRepo";
import { bn } from "@/i18n/bn";
import {
  FOOTER_LINKS_MAX,
  FOOTER_TEXT_MAX,
  MENU_LABEL_MAX,
  MENU_MAX,
  type FooterLink,
  type MenuItem,
  type MenuType,
} from "@/lib/menu";
import { footerLinkError, menuRowError, moveAt, removeAt, seedMenu, withType } from "@/lib/menuEdit";
import { useSiteSettings } from "../SiteSettingsProvider";
import { ConfirmButton } from "../ConfirmButton";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; saved: SiteSettings };
type Row<T> = T & { k: number }; // স্থির key — ক্রম বদলালে input-ফোকাস/মান গুলিয়ে না যাওয়ার জন্য
type Tab = "menu" | "footer";

const t = bn.customize;
const input = "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3";
const iconBtn = "flex size-11 items-center justify-center rounded-full border border-line disabled:opacity-40";
const pill = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const TYPE_LABEL: Record<MenuType, string> = { page: t.typePage, category: t.typeCategory, link: t.typeLink };

let keySeq = 0;
const withKey = <T extends object>(x: T): Row<T> => ({ ...x, k: ++keySeq });
const rowsOf = (s: SiteSettings) => ({ menu: s.menu.map((m) => withKey(m)), text: s.footer.text, links: s.footer.links.map((l) => withKey(l)) });

export function CustomizeForm() {
  const { setSettings } = useSiteSettings();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [pages, setPages] = useState<PageWithId[] | null>(null); // null = আনা যায়নি
  const [cats, setCats] = useState<TermWithId[] | null>(null);
  const [tab, setTab] = useState<Tab>("menu");
  const [menu, setMenu] = useState<Row<MenuItem>[]>([]);
  const [footText, setFootText] = useState("");
  const [footLinks, setFootLinks] = useState<Row<FooterLink>[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const apply = (next: SiteSettings) => {
    const r = rowsOf(next);
    setLoad({ kind: "ready", saved: next });
    setMenu(r.menu);
    setFootText(r.text);
    setFootLinks(r.links);
  };

  // সেটিং লোড ব্যর্থ হলে ফর্ম দেখানো হয় না (ডিফল্ট দিয়ে আসল মেনু ভুলে মুছে না যাওয়ার জন্য); পেজ/ক্যাটাগরি ব্যর্থ হলে শুধু 'লিংক' ধরন চলে
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [s, p, c] = await Promise.all([
          getSiteSettingsRepo().then((r) => r.get()),
          getPageRepo().then((r) => r.list()).catch(() => null),
          getTaxonomyRepo("categories").then((r) => r.list()).catch(() => null),
        ]);
        if (dead) return;
        const r = rowsOf(s);
        setPages(p);
        setCats(c);
        setLoad({ kind: "ready", saved: s });
        setMenu(r.menu);
        setFootText(r.text);
        setFootLinks(r.links);
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [tick]);

  const menuOut = useMemo<MenuItem[]>(() => menu.map(({ label, type, ref }) => ({ label: label.trim(), type, ref: ref.trim() })), [menu]);
  const footOut = useMemo(
    () => ({ text: footText.trim(), links: footLinks.map(({ label, url }) => ({ label: label.trim(), url: url.trim() })) }),
    [footText, footLinks],
  );

  if (load.kind === "loading") {
    return (
      <p role="status" className="text-muted">
        {t.loading}
      </p>
    );
  }
  if (load.kind === "error") {
    return (
      <div role="alert">
        <p className="text-accent-text">{t.loadFailed}</p>
        <button
          type="button"
          className={`mt-3 ${pill}`}
          onClick={() => {
            setLoad({ kind: "loading" });
            setTick((n) => n + 1);
          }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const saved = load.saved;
  const dirty = JSON.stringify({ m: saved.menu, f: saved.footer }) !== JSON.stringify({ m: menuOut, f: footOut });
  const hasErr = menu.some((m) => menuRowError(m)) || footLinks.some((l) => footerLinkError(l));
  const edit = () => setMsg(null);

  async function save() {
    if (busy || !dirty || hasErr) return; // double-submit নয়
    setBusy(true);
    setMsg(null);
    try {
      const repo = await getSiteSettingsRepo();
      const latest = await repo.get(); // Settings-ফর্মে ইতিমধ্যে বদলানো অন্য ফিল্ড যেন না মুছে
      const next = await repo.save({ ...latest, menu: menuOut, footer: footOut });
      setSettings(next);
      apply(next);
      const ok = await triggerSiteRebuild();
      setMsg({ ok, text: ok ? t.saved : t.savedNoRebuild });
    } catch {
      setMsg({ ok: false, text: t.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  const changeType = (i: number, type: MenuType) => {
    edit();
    setMenu((m) => m.map((x, j) => (j === i ? { ...withType(x, type), k: x.k } : x)));
  };
  const pageOpts = pages ?? [];
  const catOpts = cats ?? [];

  const refControl = (it: Row<MenuItem>, i: number, bad: boolean) => {
    const set = (ref: string) => {
      edit();
      setMenu((m) => m.map((x, j) => (j === i ? { ...x, ref } : x)));
    };
    const id = `ref-${it.k}`;
    const common = { id, className: input, "aria-invalid": bad || undefined, "aria-describedby": bad ? `e-${it.k}` : undefined };
    if (it.type === "link") {
      return (
        <input {...common} value={it.ref} maxLength={300} inputMode="url" autoCapitalize="none" onChange={(e) => set(e.target.value)} />
      );
    }
    const opts =
      it.type === "page"
        ? pageOpts.map((p) => ({ v: p.slug, text: `${p.title || p.slug} (/${p.slug})${p.status === "published" ? "" : ` — ${t.draftTag}`}` }))
        : catOpts.map((c) => ({ v: c.id, text: c.name }));
    const missing = it.ref !== "" && !opts.some((o) => o.v === it.ref);
    return (
      <select {...common} value={it.ref} onChange={(e) => set(e.target.value)}>
        <option value="">{t.pick}</option>
        {opts.map((o) => (
          <option key={o.v} value={o.v}>
            {o.text}
          </option>
        ))}
        {missing && <option value={it.ref}>{`⚠ ${t.missingTag} (${it.ref})`}</option>}
      </select>
    );
  };

  const rowButtons = (i: number, n: number, move: (d: -1 | 1) => void, del: () => void) => (
    <div className="flex gap-2">
      <button type="button" className={iconBtn} aria-label={t.moveUp} disabled={i === 0} onClick={() => move(-1)}>
        ↑
      </button>
      <button type="button" className={iconBtn} aria-label={t.moveDown} disabled={i === n - 1} onClick={() => move(1)}>
        ↓
      </button>
      <button type="button" className={iconBtn} aria-label={t.remove} onClick={del}>
        ✕
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t.tabsLabel} className="flex gap-2">
        {(["menu", "footer"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`min-h-11 rounded-full border px-4 ${tab === k ? "border-accent bg-surface font-semibold" : "border-line"}`}
            onClick={() => setTab(k)}
          >
            {k === "menu" ? t.tabMenu : t.tabFooter}
          </button>
        ))}
      </div>

      {tab === "menu" && (
        <section className="space-y-4" aria-label={t.tabMenu}>
          <p className="text-sm text-muted">{t.menuHint}</p>
          {pages === null || cats === null ? (
            <p role="alert" className="text-sm text-accent-text">
              {t.listFailed}
            </p>
          ) : null}
          {menu.length === 0 && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm">{t.menuDefaultNote}</p>
              <button
                type="button"
                className={pill}
                onClick={() => {
                  edit();
                  setMenu(seedMenu(pageOpts, { home: t.homeLabel, blog: t.blogLabel }).map((m) => withKey(m)));
                }}
              >
                {t.seedDefault}
              </button>
            </div>
          )}
          <ol className="space-y-3">
            {menu.map((it, i) => {
              const bad = menuRowError(it);
              const patch = (p: Partial<MenuItem>) => {
                edit();
                setMenu((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
              };
              const refLabel = it.type === "page" ? t.refPage : it.type === "category" ? t.refCategory : t.refLink;
              return (
                <li key={it.k} className="space-y-3 rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.itemN(i + 1)}</span>
                    {rowButtons(
                      i,
                      menu.length,
                      (d) => {
                        edit();
                        setMenu((m) => moveAt(m, i, d));
                      },
                      () => {
                        edit();
                        setMenu((m) => removeAt(m, i));
                      },
                    )}
                  </div>
                  <label className="block">
                    {t.label}
                    <input
                      className={input}
                      value={it.label}
                      maxLength={MENU_LABEL_MAX}
                      onChange={(e) => patch({ label: e.target.value })}
                      aria-invalid={bad === "label" || undefined}
                      aria-describedby={bad ? `e-${it.k}` : undefined}
                    />
                  </label>
                  <label className="block">
                    {t.type}
                    <select className={input} value={it.type} onChange={(e) => changeType(i, e.target.value as MenuType)}>
                      {(Object.keys(TYPE_LABEL) as MenuType[]).map((k) => (
                        <option key={k} value={k}>
                          {TYPE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <label htmlFor={`ref-${it.k}`}>{refLabel}</label>
                    {refControl(it, i, bad === "ref")}
                  </div>
                  {bad && (
                    <p id={`e-${it.k}`} role="alert" className="text-sm text-accent-text">
                      {bad === "label" ? t.errLabel : t.errRef}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className={pill}
            disabled={menu.length >= MENU_MAX}
            onClick={() => {
              edit();
              setMenu((m) => [...m, withKey<MenuItem>({ label: "", type: "link", ref: "" })]);
            }}
          >
            + {t.addItem}
          </button>
          {menu.length >= MENU_MAX && <p className="text-sm text-muted">{t.maxReached}</p>}
        </section>
      )}

      {tab === "footer" && (
        <section className="space-y-4" aria-label={t.tabFooter}>
          <p className="text-sm text-muted">{t.footerHint}</p>
          {footText.trim() === "" && footLinks.length === 0 && <p className="text-sm text-muted">{t.footerDefaultNote}</p>}
          <label className="block">
            {t.footerText}
            <input
              className={input}
              value={footText}
              maxLength={FOOTER_TEXT_MAX}
              onChange={(e) => {
                edit();
                setFootText(e.target.value);
              }}
            />
            <span className="mt-1 block text-sm text-muted">{t.footerTextHint}</span>
          </label>
          <h2 className="font-serif text-lg font-bold">{t.footerLinks}</h2>
          <ol className="space-y-3">
            {footLinks.map((l, i) => {
              const bad = footerLinkError(l);
              const patch = (p: Partial<FooterLink>) => {
                edit();
                setFootLinks((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
              };
              return (
                <li key={l.k} className="space-y-3 rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.itemN(i + 1)}</span>
                    {rowButtons(
                      i,
                      footLinks.length,
                      (d) => {
                        edit();
                        setFootLinks((m) => moveAt(m, i, d));
                      },
                      () => {
                        edit();
                        setFootLinks((m) => removeAt(m, i));
                      },
                    )}
                  </div>
                  <label className="block">
                    {t.label}
                    <input className={input} value={l.label} maxLength={MENU_LABEL_MAX} onChange={(e) => patch({ label: e.target.value })} aria-invalid={bad === "label" || undefined} />
                  </label>
                  <label className="block">
                    {t.footerUrl}
                    <input
                      className={input}
                      value={l.url}
                      maxLength={300}
                      inputMode="url"
                      autoCapitalize="none"
                      onChange={(e) => patch({ url: e.target.value })}
                      aria-invalid={bad === "url" || undefined}
                    />
                  </label>
                  {bad && (
                    <p role="alert" className="text-sm text-accent-text">
                      {bad === "label" ? t.errLabel : t.errUrl}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className={pill}
            disabled={footLinks.length >= FOOTER_LINKS_MAX}
            onClick={() => {
              edit();
              setFootLinks((m) => [...m, withKey<FooterLink>({ label: "", url: "" })]);
            }}
          >
            + {t.addItem}
          </button>
          {footLinks.length >= FOOTER_LINKS_MAX && <p className="text-sm text-muted">{t.maxReached}</p>}
        </section>
      )}

      <div className="sticky bottom-16 flex flex-wrap items-center gap-3 border-t border-line bg-bg py-3 min-[1024px]:bottom-0">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty || hasErr}
          className="min-h-11 rounded-full bg-btn-bg px-6 font-semibold text-btn-tx disabled:opacity-50"
        >
          {busy ? t.saving : t.save}
        </button>
        <ConfirmButton
          label={t.resetLabel}
          question={t.resetQuestion}
          disabled={busy || (menu.length === 0 && footText === "" && footLinks.length === 0)}
          className={pill}
          onConfirm={() => {
            edit();
            setMenu([]);
            setFootText("");
            setFootLinks([]);
          }}
        />
        {dirty && !msg && <span className="text-sm text-muted">{t.unsaved}</span>}
        {msg && (
          <p role="status" className={msg.ok ? "text-sm" : "text-sm text-accent-text"}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
