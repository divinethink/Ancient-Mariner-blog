import Link from "next/link";
import { bn } from "@/i18n/bn";
import { BuildStatus } from "../BuildStatus";
import { DefaultCategoryField } from "./DefaultCategoryField";
import { HomeCardPrefs } from "./HomeCardPrefs";
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
      <div className="mt-10">
        <BuildStatus />
      </div>
    </>
  );
}
