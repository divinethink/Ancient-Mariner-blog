"use client";

// P13b: লেখা → Markdown/HTML (ব্রাউজারে তৈরি, শুধু read; কিছু সংরক্ষণ হয় না)। ডিফল্ট = শুধু published+public।
import { useEffect, useRef, useState } from "react";
import { getBackupSource } from "@/data/backupRepo";
import { bn } from "@/i18n/bn";
import {
  buildHtml,
  buildMarkdown,
  exportFileName,
  readAllPosts,
  selectPosts,
  type BundleMeta,
  type ExportMode,
  type ExportPost,
} from "@/lib/exportBundle";
import { DOCX_MIME } from "@/lib/exportDocx"; // শুধু ধ্রুবক — `docx` প্যাকেজ বোতাম চাপলে lazy লোড হয়
import { useSiteTimezone } from "../SiteSettingsProvider";

type Phase = "idle" | "running" | "done" | "empty" | "error";
type DocxPhase = "idle" | "building" | "error";
type Files = { md: { url: string; name: string }; html: { url: string; name: string }; count: number };

const btn = "min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx disabled:opacity-50";
const T = bn.backup.textExport;

export function TextExportPanel() {
  const tz = useSiteTimezone();
  const [all, setAll] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [read, setRead] = useState(0);
  const [files, setFiles] = useState<Files | null>(null);
  const abort = useRef<AbortController | null>(null);
  const src = useRef<{ posts: ExportPost[]; meta: BundleMeta; now: Date } | null>(null);
  const [docx, setDocx] = useState<DocxPhase>("idle");
  const [docxFile, setDocxFile] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(
    () => () => {
      if (files) {
        URL.revokeObjectURL(files.md.url);
        URL.revokeObjectURL(files.html.url);
      }
    },
    [files],
  );

  useEffect(
    () => () => {
      if (docxFile) URL.revokeObjectURL(docxFile.url);
    },
    [docxFile],
  );

  async function makeDocx() {
    if (!src.current || docx === "building") return;
    setDocx("building");
    try {
      const { posts, meta, now } = src.current;
      const { buildDocx } = await import("@/lib/exportDocx");
      const buf = await buildDocx(posts, meta);
      const url = URL.createObjectURL(new Blob([buf], { type: DOCX_MIME }));
      setDocxFile({ url, name: exportFileName(now, "docx") });
      setDocx("idle");
    } catch {
      setDocx("error"); // Markdown/HTML অক্ষত থাকে
    }
  }

  async function run() {
    if (phase === "running") return;
    const ac = new AbortController();
    abort.current = ac;
    setPhase("running");
    setRead(0);
    setFiles(null);
    setDocxFile(null);
    setDocx("idle");
    src.current = null;
    try {
      const mode: ExportMode = all ? "all" : "published";
      const docs = await readAllPosts(await getBackupSource(), { signal: ac.signal, onProgress: setRead });
      const posts = selectPosts(docs, mode);
      if (posts.length === 0) {
        setPhase("empty");
        return;
      }
      const now = new Date();
      const meta = { heading: T.heading, exportedAt: now, timeZone: tz, mode };
      const url = (text: string, type: string) => URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
      src.current = { posts, meta, now };
      setFiles({
        md: { url: url(buildMarkdown(posts, meta), "text/markdown"), name: exportFileName(now, "md") },
        html: { url: url(buildHtml(posts, meta), "text/html"), name: exportFileName(now, "html") },
        count: posts.length,
      });
      setPhase("done");
    } catch {
      setPhase(ac.signal.aborted ? "idle" : "error"); // আংশিক ফাইল কখনো দেওয়া হয় না
    }
  }

  return (
    <section aria-label={T.title} className="mt-10 space-y-4">
      <h2 className="font-serif text-2xl font-bold">{T.title}</h2>
      <p className="text-muted">{T.intro}</p>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={all}
          disabled={phase === "running"}
          onChange={(e) => setAll(e.target.checked)}
          className="size-6 accent-[var(--accent)]"
        />
        {T.all}
      </label>
      <p className={all ? "text-accent-text" : "text-sm text-muted"}>{all ? T.allWarn : T.onlyPublished}</p>

      {phase === "error" && (
        <p role="alert" className="text-accent-text">
          {T.failed}
        </p>
      )}
      {phase === "empty" && <p role="status">{T.empty}</p>}
      {phase === "running" ? (
        <div className="space-y-2">
          <p role="status" className="text-muted">
            {T.running(read)}
          </p>
          <button type="button" onClick={() => abort.current?.abort()} className="min-h-11 rounded-full border border-line px-5">
            {T.cancel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void run()} className={btn}>
          {phase === "done" ? T.again : phase === "error" ? bn.backup.retry : T.startBtn}
        </button>
      )}
      {phase === "done" && files && (
        <div className="space-y-2">
          <p role="status">{T.ready(files.count)}</p>
          <a href={files.md.url} download={files.md.name} className={`${btn} inline-flex items-center`}>
            ⬇ {T.mdLabel}
          </a>{" "}
          <a href={files.html.url} download={files.html.name} className={`${btn} inline-flex items-center`}>
            ⬇ {T.htmlLabel}
          </a>
          {docxFile ? (
            <p>
              <a href={docxFile.url} download={docxFile.name} className={`${btn} inline-flex items-center`}>
                ⬇ {T.docxLabel}
              </a>
            </p>
          ) : (
            <p>
              <button
                type="button"
                onClick={() => void makeDocx()}
                disabled={docx === "building"}
                className="min-h-11 rounded-full border border-line px-5 disabled:opacity-50"
              >
                {docx === "building" ? T.docxBuilding : T.docxBtn}
              </button>
            </p>
          )}
          {docx === "error" && (
            <p role="alert" className="text-accent-text">
              {T.docxFailed}
            </p>
          )}
          {docxFile && <p className="text-sm text-muted">{T.docxHint}</p>}
          <p className="text-sm text-muted">{bn.backup.keepSafe}</p>
        </div>
      )}
    </section>
  );
}
