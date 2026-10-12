"use client";

// সাইট সাজান (P9a-২/৩, P9b-২): মেনু, footer, sidebar/Home, design (রঙ/ফন্ট/card/লোগো/ব্যানার) (চালু-বন্ধ ও ক্রম), ফেসবুক URL, লিংক-তালিকা। সেভ = একটাই `siteSettings` write
// (সর্বশেষ মান আবার পড়ে শুধু এই ফিল্ডগুলো বদলায় — Settings-ফর্মের অন্য ফিল্ড মুছে যায় না), তারপর rebuild। ক্রম-বদল ↑↓ বোতামে (অনুমোদিত সিদ্ধান্ত: @dnd-kit নয়)।
import { useEffect, useMemo, useState } from "react";
import type { PageWithId } from "@/data/pageRepo";
import { getPageRepo } from "@/data/pageRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/data/siteSettingsRepo";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import type { TermWithId } from "@/data/taxonomyRepo";
import { ItemCard } from "@/components/ui/ItemCard";
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
import { DEFAULT_DESIGN } from "@/lib/design";
import { DEFAULT_HOME, DEFAULT_SIDEBAR, LAYOUT_TITLE_MAX, cleanTitles, resolveLayout } from "@/lib/layout";
import { LINK_LABEL_MAX, facebookError, siteLinkError, toggleAt, type SiteLink } from "@/lib/layoutEdit";
import { LINKS_MAX, URL_MAX } from "@/lib/siteSettings";
import { useSiteSettings } from "../SiteSettingsProvider";
import { ConfirmButton } from "../ConfirmButton";
import { DesignTab } from "./DesignTab";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; saved: SiteSettings };
type Row<T> = T & { k: number }; // স্থির key — ক্রম বদলালে input-ফোকাস/মান গুলিয়ে না যাওয়ার জন্য
type Tab = "menu" | "footer" | "sidebar" | "home" | "design";
type LayoutRow = { id: string; enabled: boolean; title?: string };

const t = bn.customize;
const input = "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3";
const iconBtn = "flex size-11 items-center justify-center rounded-full border border-line disabled:opacity-40";
const pill = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const TYPE_LABEL: Record<MenuType, string> = { page: t.typePage, category: t.typeCategory, link: t.typeLink };

let keySeq = 0;
const withKey = <T extends object>(x: T): Row<T> => ({ ...x, k: ++keySeq });
const sidebarOf = (s: SiteSettings): LayoutRow[] => resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR);
const homeOf = (s: SiteSettings): LayoutRow[] => resolveLayout(s.layout.home, DEFAULT_HOME);
const rowsOf = (s: SiteSettings) => ({
  menu: s.menu.map((m) => withKey(m)),
  text: s.footer.text,
  links: s.footer.links.map((l) => withKey(l)),
  sidebar: sidebarOf(s),
  home: homeOf(s),
  fb: s.socialLinks.facebook,
  siteLinks: s.links.map((l) => withKey(l)),
  design: s.design,
});

export function CustomizeForm({ initialTab }: { initialTab?: Tab }) {
  const { setSettings } = useSiteSettings();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [pages, setPages] = useState<PageWithId[] | null>(null); // null = আনা যায়নি
  const [cats, setCats] = useState<TermWithId[] | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab ?? "menu");
  const [menu, setMenu] = useState<Row<MenuItem>[]>([]);
  const [footText, setFootText] = useState("");
  const [footLinks, setFootLinks] = useState<Row<FooterLink>[]>([]);
  const [sidebar, setSidebar] = useState<LayoutRow[]>([]);
  const [home, setHome] = useState<LayoutRow[]>([]);
  const [fb, setFb] = useState("");
  const [siteLinks, setSiteLinks] = useState<Row<SiteLink>[]>([]);
  const [design, setDesign] = useState<SiteSettings["design"]>(DEFAULT_SETTINGS.design);
  const [openK, setOpenK] = useState<number | null>(null); // কোন সারি খোলা (শুধু চেহারা)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const apply = (next: SiteSettings) => {
    const r = rowsOf(next);
    setLoad({ kind: "ready", saved: next });
    setMenu(r.menu);
    setFootText(r.text);
    setFootLinks(r.links);
    setSidebar(r.sidebar);
    setHome(r.home);
    setFb(r.fb);
    setSiteLinks(r.siteLinks);
    setDesign(r.design);
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
        setSidebar(r.sidebar);
        setHome(r.home);
        setFb(r.fb);
        setSiteLinks(r.siteLinks);
        setDesign(r.design);
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

  const linksOut = useMemo<SiteLink[]>(() => siteLinks.map(({ label, url }) => ({ label: label.trim(), url: url.trim() })), [siteLinks]);

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
  const fbOut = fb.trim();
  const dirty =
    JSON.stringify({ m: saved.menu, f: saved.footer, s: sidebarOf(saved), h: homeOf(saved), b: saved.socialLinks.facebook, l: saved.links, d: saved.design }) !==
    JSON.stringify({ m: menuOut, f: footOut, s: cleanTitles(sidebar), h: home, b: fbOut, l: linksOut, d: design });
  const hasErr =
    menu.some((m) => menuRowError(m)) ||
    footLinks.some((l) => footerLinkError(l)) ||
    facebookError(fb) ||
    siteLinks.some((l) => siteLinkError(l));
  const isDefaultAll =
    menu.length === 0 &&
    footText === "" &&
    footLinks.length === 0 &&
    JSON.stringify(cleanTitles(sidebar)) === JSON.stringify(resolveLayout([], DEFAULT_SIDEBAR)) &&
    JSON.stringify(home) === JSON.stringify(resolveLayout([], DEFAULT_HOME)) &&
    design.accent === DEFAULT_DESIGN.accent &&
    design.fontPair === DEFAULT_DESIGN.fontPair &&
    design.cardStyle === DEFAULT_DESIGN.cardStyle;
  const edit = () => setMsg(null);

  async function save() {
    if (busy || !dirty || hasErr) return; // double-submit নয়
    setBusy(true);
    setMsg(null);
    try {
      const repo = await getSiteSettingsRepo();
      const latest = await repo.get(); // Settings-ফর্মে ইতিমধ্যে বদলানো অন্য ফিল্ড যেন না মুছে
      const next = await repo.save({
        ...latest,
        menu: menuOut,
        footer: footOut,
        layout: { sidebar: cleanTitles(sidebar), home },
        socialLinks: { ...latest.socialLinks, facebook: fbOut },
        links: linksOut,
        design,
      });
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
    <div className="flex gap-1">
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

  const layoutList = (
    rows: LayoutRow[],
    set: (r: LayoutRow[]) => void,
    names: Record<string, string>,
    label: string,
    renamable = false,
  ) => (
    <ol className="space-y-3" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5"
              checked={r.enabled}
              onChange={() => {
                edit();
                set(toggleAt(rows, i));
              }}
            />
            <span className={r.enabled ? "font-semibold" : "text-muted"}>
              {names[r.id] ?? r.id} {!r.enabled && <span className="text-sm">({t.off})</span>}
            </span>
          </label>
          {renamable && r.id !== "author" && (
            <label className="block w-full text-sm text-muted">
              {t.widgetNameLabel}
              <input
                type="text"
                className={input}
                maxLength={LAYOUT_TITLE_MAX}
                placeholder={names[r.id] ?? r.id}
                value={r.title ?? ""}
                onChange={(e) => {
                  edit();
                  set(rows.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)));
                }}
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={iconBtn}
              aria-label={`${names[r.id] ?? r.id}: ${t.moveUp}`}
              disabled={i === 0}
              onClick={() => {
                edit();
                set(moveAt(rows, i, -1));
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`${names[r.id] ?? r.id}: ${t.moveDown}`}
              disabled={i === rows.length - 1}
              onClick={() => {
                edit();
                set(moveAt(rows, i, 1));
              }}
            >
              ↓
            </button>
          </div>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t.tabsLabel} className="-m-1 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["menu", "footer", "sidebar", "home", "design"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`min-h-11 shrink-0 grow whitespace-nowrap rounded-full border px-4 ${tab === k ? "border-accent bg-surface font-semibold" : "border-line"}`}
            onClick={() => setTab(k)}
          >
            {{ menu: t.tabMenu, footer: t.tabFooter, sidebar: t.tabSidebar, home: t.tabHome, design: t.tabDesign }[k]}
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
          <ol className="space-y-2">
            {menu.map((it, i) => {
              const bad = menuRowError(it);
              const patch = (p: Partial<MenuItem>) => {
                edit();
                setMenu((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
              };
              const refLabel = it.type === "page" ? t.refPage : it.type === "category" ? t.refCategory : t.refLink;
              const target = it.type === "link" ? it.ref : it.type === "page" ? (it.ref ? `/${it.ref}` : "") : (catOpts.find((c) => c.id === it.ref)?.name ?? "");
              return (
                <ItemCard
                  key={it.k}
                  title={it.label.trim() || t.itemN(i + 1)}
                  sub={bad ? (bad === "label" ? t.errLabel : t.errRef) : [TYPE_LABEL[it.type], target].filter(Boolean).join(" · ")}
                  invalid={!!bad}
                  open={openK === it.k}
                  onToggle={() => setOpenK((k) => (k === it.k ? null : it.k))}
                  actions={rowButtons(
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
                >
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block min-w-0 text-sm">
                      {t.labelShort}
                      <input
                        className={input}
                        value={it.label}
                        maxLength={MENU_LABEL_MAX}
                        onChange={(e) => patch({ label: e.target.value })}
                        aria-invalid={bad === "label" || undefined}
                        aria-describedby={bad ? `e-${it.k}` : undefined}
                      />
                    </label>
                    <label className="block min-w-0 text-sm">
                      {t.type}
                      <select className={input} value={it.type} onChange={(e) => changeType(i, e.target.value as MenuType)}>
                        {(Object.keys(TYPE_LABEL) as MenuType[]).map((k) => (
                          <option key={k} value={k}>
                            {TYPE_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="text-sm">
                    <label htmlFor={`ref-${it.k}`}>{refLabel}</label>
                    {refControl(it, i, bad === "ref")}
                  </div>
                  {bad && (
                    <p id={`e-${it.k}`} role="alert" className="text-sm text-accent-text">
                      {bad === "label" ? t.errLabel : t.errRef}
                    </p>
                  )}
                </ItemCard>
              );
            })}
          </ol>
          <button
            type="button"
            className={pill}
            disabled={menu.length >= MENU_MAX}
            onClick={() => {
              edit();
              const n = withKey<MenuItem>({ label: "", type: "link", ref: "" });
              setMenu((m) => [...m, n]);
              setOpenK(n.k);
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
          <ol className="space-y-2">
            {footLinks.map((l, i) => {
              const bad = footerLinkError(l);
              const patch = (p: Partial<FooterLink>) => {
                edit();
                setFootLinks((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
              };
              return (
                <ItemCard
                  key={l.k}
                  title={l.label.trim() || t.itemN(i + 1)}
                  sub={bad ? (bad === "label" ? t.errLabel : t.errUrl) : l.url}
                  invalid={!!bad}
                  open={openK === l.k}
                  onToggle={() => setOpenK((k) => (k === l.k ? null : l.k))}
                  actions={rowButtons(
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
                >
                  <label className="block text-sm">
                    {t.labelShort}
                    <input className={input} value={l.label} maxLength={MENU_LABEL_MAX} onChange={(e) => patch({ label: e.target.value })} aria-invalid={bad === "label" || undefined} />
                  </label>
                  <label className="block text-sm">
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
                </ItemCard>
              );
            })}
          </ol>
          <button
            type="button"
            className={pill}
            disabled={footLinks.length >= FOOTER_LINKS_MAX}
            onClick={() => {
              edit();
              const n = withKey<FooterLink>({ label: "", url: "" });
              setFootLinks((m) => [...m, n]);
              setOpenK(n.k);
            }}
          >
            + {t.addItem}
          </button>
          {footLinks.length >= FOOTER_LINKS_MAX && <p className="text-sm text-muted">{t.maxReached}</p>}
        </section>
      )}

      {tab === "sidebar" && (
        <section className="space-y-4" aria-label={t.tabSidebar}>
          <p className="text-sm text-muted">{t.sidebarHint}</p>
          {layoutList(sidebar, setSidebar, t.widgets, t.tabSidebar, true)}
          <label className="block">
            {t.fbLabel}
            <input
              className={input}
              value={fb}
              maxLength={URL_MAX}
              inputMode="url"
              autoCapitalize="none"
              onChange={(e) => {
                edit();
                setFb(e.target.value);
              }}
              aria-invalid={facebookError(fb) || undefined}
              aria-describedby="e-fb"
            />
            <span className="mt-1 block text-sm text-muted">{t.fbHint}</span>
          </label>
          {facebookError(fb) && (
            <p id="e-fb" role="alert" className="text-sm text-accent-text">
              {t.errFb}
            </p>
          )}
          <h2 className="font-serif text-lg font-bold">{t.linkListTitle}</h2>
          <p className="text-sm text-muted">{t.linkListHint}</p>
          <ol className="space-y-2">
            {siteLinks.map((l, i) => {
              const bad = siteLinkError(l);
              const patch = (p: Partial<SiteLink>) => {
                edit();
                setSiteLinks((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
              };
              return (
                <ItemCard
                  key={l.k}
                  title={l.label.trim() || t.itemN(i + 1)}
                  sub={bad ? (bad === "label" ? t.errLabel : t.errLinkUrl) : l.url}
                  invalid={!!bad}
                  open={openK === l.k}
                  onToggle={() => setOpenK((k) => (k === l.k ? null : l.k))}
                  actions={rowButtons(
                    i,
                    siteLinks.length,
                    (d) => {
                      edit();
                      setSiteLinks((m) => moveAt(m, i, d));
                    },
                    () => {
                      edit();
                      setSiteLinks((m) => removeAt(m, i));
                    },
                  )}
                >
                  <label className="block text-sm">
                    {t.labelShort}
                    <input className={input} value={l.label} maxLength={LINK_LABEL_MAX} onChange={(e) => patch({ label: e.target.value })} aria-invalid={bad === "label" || undefined} />
                  </label>
                  <label className="block text-sm">
                    {t.linkUrl}
                    <input
                      className={input}
                      value={l.url}
                      maxLength={URL_MAX}
                      inputMode="url"
                      autoCapitalize="none"
                      onChange={(e) => patch({ url: e.target.value })}
                      aria-invalid={bad === "url" || undefined}
                    />
                  </label>
                  {bad && (
                    <p role="alert" className="text-sm text-accent-text">
                      {bad === "label" ? t.errLabel : t.errLinkUrl}
                    </p>
                  )}
                </ItemCard>
              );
            })}
          </ol>
          <button
            type="button"
            className={pill}
            disabled={siteLinks.length >= LINKS_MAX}
            onClick={() => {
              edit();
              const n = withKey<SiteLink>({ label: "", url: "" });
              setSiteLinks((m) => [...m, n]);
              setOpenK(n.k);
            }}
          >
            + {t.addItem}
          </button>
          {siteLinks.length >= LINKS_MAX && <p className="text-sm text-muted">{t.maxReached}</p>}
        </section>
      )}

      {tab === "home" && (
        <section className="space-y-4" aria-label={t.tabHome}>
          <p className="text-sm text-muted">{t.homeHint}</p>
          {layoutList(home, setHome, t.sections, t.tabHome)}
        </section>
      )}

      {tab === "design" && <DesignTab value={design} onChange={(d) => { edit(); setDesign(d); }} />}

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
          disabled={busy || isDefaultAll}
          className={pill}
          onConfirm={() => {
            edit();
            setMenu([]);
            setFootText("");
            setFootLinks([]);
            setSidebar(resolveLayout([], DEFAULT_SIDEBAR));
            setHome(resolveLayout([], DEFAULT_HOME));
            setDesign((d) => ({ ...d, ...DEFAULT_DESIGN })); // লোগো/ব্যানার অক্ষত
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
