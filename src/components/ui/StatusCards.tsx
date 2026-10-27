// পাশাপাশি এক সারির সংখ্যা-কার্ড (বইয়ের তাক/ভ্রমণ): সংখ্যা বড়, নিচে নাম; চাপলে সেই অবস্থার তালিকা। state বাইরে থাকে।
export type StatusCardOption<T extends string> = { value: T; label: string; count: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly StatusCardOption<T>[];
  onChange: (v: T) => void;
};

export function StatusCards<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border px-2 py-2 transition-colors ${
              on ? "border-btn-bg bg-btn-bg text-btn-tx shadow-sm" : "border-line bg-surface text-muted hover:bg-line"
            }`}
          >
            <span className="font-serif text-2xl font-bold leading-none">{o.count}</span>
            <span className="mt-1 text-sm">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
