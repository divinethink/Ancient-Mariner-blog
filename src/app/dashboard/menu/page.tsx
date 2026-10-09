import Link from "next/link";
import { bn } from "@/i18n/bn";
import { IdeaInboxMenuItem } from "../IdeaInboxMenuItem";
import { LogoutButton } from "../LogoutButton";

// P2a-৩: list-style মেনু (Mockup §৭.৭), phase-gated — এখন শুধু সেটিংস; বাকি আইটেম সংশ্লিষ্ট phase-এ
export default function MenuPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.menu}</h1>
      <ul className="mb-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        <li>
          <IdeaInboxMenuItem />
        </li>
        <li>
          <Link href="/dashboard/pages" className="flex min-h-12 items-center justify-between px-4">
            <span>📄 {bn.dashboard.pages}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/media" className="flex min-h-12 items-center justify-between px-4">
            <span>🖼️ {bn.dashboard.media}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/import" className="flex min-h-12 items-center justify-between px-4">
            <span>📥 {bn.dashboard.importWp}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/library" className="flex min-h-12 items-center justify-between px-4">
            <span>🗂️ {bn.dashboard.organize}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/settings" className="flex min-h-12 items-center justify-between px-4">
            <span>⚙️ {bn.dashboard.settings}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/backups" className="flex min-h-12 items-center justify-between px-4">
            <span>☁️ {bn.backup.title}</span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
      </ul>
      <LogoutButton />
    </>
  );
}
