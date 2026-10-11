import Link from "next/link";
import { bn } from "@/i18n/bn";
import { BuildStatus } from "../BuildStatus";
import { DefaultCategoryField } from "./DefaultCategoryField";
import { HomeCardPrefs } from "./HomeCardPrefs";
import { SearchIndexPanel } from "./SearchIndexPanel";
import { SettingsForm } from "./SettingsForm";

export default function SettingsPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-6 font-serif text-3xl font-bold">{bn.settings.title}</h1>
      <SettingsForm />
      <DefaultCategoryField />
      <HomeCardPrefs />
      <SearchIndexPanel />
      <Link
        href="/dashboard/settings/legacy-guide"
        className="mt-10 flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
      >
        <span>
          <span className="block font-semibold">{bn.legacy.settingsLink}</span>
          <span className="block text-sm text-muted">{bn.legacy.settingsLinkHint}</span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </Link>
      <div className="mt-10">
        <BuildStatus />
      </div>
    </>
  );
}
