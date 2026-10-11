import Link from "next/link";
import { bn } from "@/i18n/bn";

// P13a: static গাইড — কোনো ডেটা পড়ে/লেখে না; /dashboard/* আগে থেকেই middleware-সুরক্ষিত ও SW-NetworkOnly।
const L = bn.legacy;
const STEPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [L.step1Title, L.step1],
  [L.step2Title, L.step2],
  [L.step3Title, L.step3],
  [L.step4Title, L.step4],
];

export default function LegacyGuidePage() {
  return (
    <>
      <Link href="/dashboard/settings" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {L.back}
      </Link>
      <h1 className="mb-2 font-serif text-3xl font-bold">{L.title}</h1>
      <p className="mb-6 text-muted">{L.intro}</p>
      <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-serif text-xl font-bold">{L.whyTitle}</h2>
        <p>{L.why}</p>
      </section>
      {STEPS.map(([title, items]) => (
        <section key={title} className="mb-6">
          <h2 className="mb-2 font-serif text-xl font-bold">{title}</h2>
          <ul className="list-disc space-y-2 pl-6">
            {items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted">{L.note}</p>
    </>
  );
}
