"use client";

// ক্যাটাগরি/ট্যাগ/সিরিজ CRUD (Mockup §৭.১৩; Checklist P3a-২খ)। সব লেখা data-layer (taxonomyRepo/taxonomyOps) দিয়ে;
// একসময়ে একটাই চলমান কাজ (`working`) — rename-propagation চলাকালীন বাকি বোতাম disabled।
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import type { PropagateResult, TaxonomyOps } from "@/data/taxonomyOps";
import { getTaxonomyOps } from "@/data/taxonomyOps.wire";
import {
  TERM_NAME_MAX,
  TermInUseError,
  TermNameSchema,
  TermRuleError,
  type TaxonomyRepo,
  type TermWithId,
} from "@/data/taxonomyRepo";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import { bn } from "@/i18n/bn";
import { TAXONOMY_KIND, type TaxonomyKind } from "@/lib/enums";
import { newId } from "@/lib/id";
import { buildCategoryTree, COUNT_LIST_LIMIT, parentChoices } from "@/lib/taxonomy";

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; terms: TermWithId[]; counts: Record<string, number>; defaultId: string | null };
type Note = { ok: boolean; text: string } | null;
type Retry = { id: string } | null;

const input = "min-h-11 w-full rounded-lg border border-line bg-surface px-3";
const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const primary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";

const rows = (kind: TaxonomyKind, terms: TermWithId[]): { term: TermWithId; depth: 0 | 1 }[] =>
  kind === "categories" ? buildCategoryTree(terms) : terms.map((term) => ({ term, depth: 0 as const }));

export function TaxonomyManager() {
  const [kind, setKind] = useState<TaxonomyKind>("categories");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [retry, setRetry] = useState<Retry>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // kind বদলালে/retry-তে তালিকা ও (সংখ্যা ছোট হলে) ব্যবহার-সংখ্যা আনা
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [repo, ops] = await Promise.all([getTaxonomyRepo(kind), getTaxonomyOps()]);
        const [terms, defaultId] = await Promise.all([
          repo.list(),
          kind === "categories" ? ops.getDefaultCategoryId() : Promise.resolve(null),
        ]);
        const counts: Record<string, number> = {};
        if (terms.length <= COUNT_LIST_LIMIT) {
          await Promise.all(
            terms.map(async (t) => {
              try {
                counts[t.id] = await ops.usage(kind, t.id);
              } catch {
                // সংখ্যা না এলে শুধু সংখ্যা-ছাড়া দেখায়; তালিকা ভাঙে না
              }
            }),
          );
        }
        if (!dead) setLoad({ kind: "ready", terms, counts, defaultId });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [kind, tick]);

  const reload = useCallback(() => {
    setLoad({ kind: "loading" });
    setTick((n) => n + 1);
  }, []);

  function switchKind(k: TaxonomyKind) {
    if (working || k === kind) return;
    setKind(k);
    setNote(null);
    setRetry(null);
    setEditing(null);
    setDeleting(null);
    setLoad({ kind: "loading" });
  }

  /** প্রকাশিত লেখা প্রভাবিত হলে সাইট rebuild (Arch §১২); বার্তার টুকরো ফেরত */
  async function maybeRebuild(r: PropagateResult): Promise<string> {
    if (r.publishedAffected <= 0) return "";
    return ` ${(await triggerSiteRebuild()) ? bn.org.siteRebuild : bn.org.siteRebuildFailed}`;
  }

  async function afterPropagate(r: PropagateResult, id: string) {
    const extra = await maybeRebuild(r);
    if (r.failed > 0) {
      setRetry({ id });
      setNote({ ok: false, text: `${bn.org.renamePartial(r.failed)}${extra}` });
    } else {
      setRetry(null);
      setNote({ ok: true, text: `${bn.org.renameDone(r.updated)}${extra}` });
    }
  }

  async function onRename(id: string, name: string, parentId: string | null | undefined) {
    if (working || load.kind !== "ready") return;
    const cur = load.terms.find((t) => t.id === id);
    if (!cur) return;
    const parsed = TermNameSchema.safeParse(name);
    if (!parsed.success) {
      setNote({ ok: false, text: bn.org.nameInvalid });
      return;
    }
    const nameChanged = parsed.data !== cur.name;
    const parentChanged = kind === "categories" && parentId !== undefined && (parentId ?? undefined) !== cur.parentCategoryId;
    if (!nameChanged && !parentChanged) {
      setEditing(null);
      return;
    }
    setNote(null);
    setWorking(id);
    try {
      const ops: TaxonomyOps = await getTaxonomyOps();
      if (nameChanged && kind !== "series") {
        const n = load.counts[id] ?? (await ops.usage(kind, id));
        if (n > 0 && !window.confirm(bn.org.renameConfirm(n))) {
          setWorking(null);
          return;
        }
      }
      if (parentChanged) await (await getTaxonomyRepo(kind)).update(id, { parentCategoryId: parentId ?? null });
      if (nameChanged) await afterPropagate(await ops.rename(kind, id, parsed.data), id);
      else setNote({ ok: true, text: bn.org.saved });
      setEditing(null);
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof TermRuleError ? bn.org.ruleFailed : bn.org.renameFailed });
    } finally {
      setWorking(null);
    }
  }

  async function onRetry(id: string) {
    if (working) return;
    setNote(null);
    setWorking(id);
    try {
      await afterPropagate(await (await getTaxonomyOps()).propagateName(kind, id), id);
      reload();
    } catch {
      setNote({ ok: false, text: bn.org.renameFailed });
    } finally {
      setWorking(null);
    }
  }

  async function onDelete(id: string) {
    if (working) return;
    setNote(null);
    setWorking(id);
    try {
      await (await getTaxonomyOps()).remove(kind, id);
      setDeleting(null);
      reload();
    } catch (e) {
      setDeleting(null);
      setNote({
        ok: false,
        text:
          e instanceof TermInUseError
            ? bn.org.inUse(e.count)
            : e instanceof TermRuleError
              ? bn.org.hasChildren
              : bn.org.deleteFailed,
      });
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={bn.org.tabs} className="mb-4 flex flex-wrap gap-2">
        {TAXONOMY_KIND.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            disabled={!!working}
            onClick={() => switchKind(k)}
            className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-50 ${
              kind === k ? "border-transparent bg-btn-bg text-btn-tx" : "border-line"
            }`}
          >
            {bn.org.kind[k]}
          </button>
        ))}
      </div>

      {load.kind === "ready" && (
        <AddForm
          key={`${kind}-${tick}`}
          kind={kind}
          terms={load.terms}
          disabled={!!working}
          onCreated={() => {
            setNote(null);
            reload();
          }}
        />
      )}

      {note && (
        <p role={note.ok ? "status" : "alert"} className={`mb-3 text-sm ${note.ok ? "text-muted" : "text-accent-text"}`}>
          {note.text}
          {!note.ok && retry && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => void onRetry(retry.id)}
                disabled={!!working}
                className="min-h-11 text-accent-text underline disabled:opacity-50"
              >
                {bn.org.renameRetry}
              </button>
            </>
          )}
        </p>
      )}

      {load.kind === "loading" && (
        <p role="status" className="text-muted">
          {bn.org.loading}
        </p>
      )}
      {load.kind === "error" && (
        <p role="alert" className="text-accent-text">
          {bn.org.loadFailed}{" "}
          <button type="button" onClick={reload} className="min-h-11 underline">
            {bn.org.retry}
          </button>
        </p>
      )}
      {load.kind === "ready" &&
        (load.terms.length === 0 ? (
          <p className="text-muted">{bn.org.empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows(kind, load.terms).map(({ term, depth }) => {
              const isDefault = kind === "categories" && term.id === load.defaultId;
              return (
                <li key={term.id} className={depth ? "ml-6" : ""}>
                  {editing === term.id ? (
                    <EditRow
                      kind={kind}
                      term={term}
                      terms={load.terms}
                      busy={working === term.id}
                      disabled={!!working}
                      onSave={(n, p) => void onRename(term.id, n, p)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4">
                      <span className="min-w-0 flex-1 py-3">
                        <span className="block truncate font-semibold">{term.name}</span>
                        <span className="text-sm text-muted">
                          {load.counts[term.id] !== undefined && bn.org.count(load.counts[term.id])}
                          {isDefault && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{bn.org.isDefault}</span>}
                          {working === term.id && <span className="ml-2">{bn.org.updating}</span>}
                        </span>
                      </span>
                      {deleting === term.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-sm">{bn.org.confirmDelete}</span>
                          <button type="button" disabled={!!working} onClick={() => void onDelete(term.id)} className={ghost}>
                            {bn.trash.yes}
                          </button>
                          <button type="button" disabled={!!working} onClick={() => setDeleting(null)} className={ghost}>
                            {bn.trash.cancel}
                          </button>
                        </span>
                      ) : (
                        <RowMenu
                          disabled={!!working}
                          canDelete={!isDefault}
                          onRename={() => {
                            setNote(null);
                            setEditing(term.id);
                          }}
                          onDelete={() => {
                            setNote(null);
                            setDeleting(term.id);
                          }}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

function AddForm(props: {
  kind: TaxonomyKind;
  terms: TermWithId[];
  disabled: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // retry/double-submit-এ duplicate নয়: সফল না হওয়া পর্যন্ত একই id (create idempotent)
  const idRef = useRef(newId());
  const choices = props.kind === "categories" ? parentChoices(props.terms, null) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || props.disabled) return;
    if (!TermNameSchema.safeParse(name).success) {
      setErr(bn.org.nameInvalid);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const repo: TaxonomyRepo = await getTaxonomyRepo(props.kind);
      await repo.create({ id: idRef.current, name, ...(parent ? { parentCategoryId: parent } : {}) });
      idRef.current = newId();
      setName("");
      setParent("");
      props.onCreated();
    } catch (e2) {
      setErr(e2 instanceof TermRuleError ? bn.org.ruleFailed : bn.org.createFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mb-5 space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-serif text-lg font-bold">{bn.org.newKind[props.kind]}</h2>
      <label className="block text-sm text-muted">
        {bn.org.name}
        <input
          className={`${input} mt-1 text-base text-text`}
          value={name}
          maxLength={TERM_NAME_MAX}
          lang="bn"
          onChange={(e) => {
            setName(e.target.value);
            setErr(null);
          }}
        />
      </label>
      {choices.length > 0 && (
        <label className="block text-sm text-muted">
          {bn.org.parent}
          <select className={`${input} mt-1 text-base text-text`} value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">{bn.org.noParent}</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {err && (
        <p role="alert" className="text-sm text-accent-text">
          {err}
        </p>
      )}
      <button type="submit" disabled={busy || props.disabled || name.trim() === ""} className={primary}>
        {busy ? bn.org.adding : bn.org.add}
      </button>
    </form>
  );
}

function EditRow(props: {
  kind: TaxonomyKind;
  term: TermWithId;
  terms: TermWithId[];
  busy: boolean;
  disabled: boolean;
  onSave: (name: string, parentId: string | null | undefined) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(props.term.name);
  const [parent, setParent] = useState(props.term.parentCategoryId ?? "");
  const choices = props.kind === "categories" ? parentChoices(props.terms, props.term.id) : [];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave(name, props.kind === "categories" ? parent || null : undefined);
      }}
      className="space-y-3 rounded-2xl border border-accent bg-surface p-4"
    >
      <label className="block text-sm text-muted">
        {bn.org.name}
        <input
          className={`${input} mt-1 text-base text-text`}
          value={name}
          maxLength={TERM_NAME_MAX}
          lang="bn"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {choices.length > 0 && (
        <label className="block text-sm text-muted">
          {bn.org.parent}
          <select className={`${input} mt-1 text-base text-text`} value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">{bn.org.noParent}</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={props.disabled || name.trim() === ""} className={primary}>
          {props.busy ? bn.org.updating : bn.org.save}
        </button>
        <button type="button" disabled={props.disabled} onClick={props.onCancel} className={ghost}>
          {bn.org.cancel}
        </button>
      </div>
    </form>
  );
}

function RowMenu(props: { disabled: boolean; canDelete: boolean; onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={bn.org.menuOpen}
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 min-w-11 rounded-full text-xl disabled:opacity-50"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 flex flex-col rounded-xl border border-line bg-surface shadow">
          <button
            type="button"
            className="min-h-11 whitespace-nowrap px-4 text-left"
            onClick={() => {
              setOpen(false);
              props.onRename();
            }}
          >
            {bn.org.rename}
          </button>
          {props.canDelete && (
            <button
              type="button"
              className="min-h-11 whitespace-nowrap px-4 text-left"
              onClick={() => {
                setOpen(false);
                props.onDelete();
              }}
            >
              {bn.org.delete}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
