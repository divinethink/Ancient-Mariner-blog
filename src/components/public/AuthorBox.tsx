import { bn } from "@/i18n/bn";

/** পোস্টের শেষে লেখক-পরিচিতি (Arch §১৭ P4b): `authorBio` খালি হলে লুকানো; layout-নিরপেক্ষ। 'এই আমি'-লিংক P4b-১ (Pages)-এর পর যোগ হবে। */
export function AuthorBox({ name, bio, compact = false }: { name: string; bio: string; compact?: boolean }) {
  const text = bio.trim();
  if (text === "") return null;
  const initial = Array.from(name.trim())[0] ?? "";
  return (
    <aside aria-label={bn.public.authorBlock} className={`${compact ? "" : "mt-10 "}flex gap-4 rounded-2xl border border-line bg-surface p-4`}>
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-btn-bg font-serif text-lg font-bold text-btn-tx"
      >
        {initial}
      </span>
      <div>
        <p className="font-serif font-bold">{name}</p>
        <p className="mt-1 whitespace-pre-line text-muted">{text}</p>
      </div>
    </aside>
  );
}
