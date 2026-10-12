// একই সারির chip-বাছাই (ধাপ ক): পরিসর/ফিল্টার/দৃশ্যমানতা। state বাইরে থাকে — এটা শুধু চেহারা।
// জায়গা না হলে সারির ভেতরেই অনুভূমিক স্ক্রল (পেজ নয়); জায়গা থাকলে chip ভরে নেয়।
export type SegmentedOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** aria-label (দৃশ্যমান লেবেল না থাকলেও বাধ্যতামূলক) */
  label: string;
  /** true হলে `label` বাঁ পাশে দেখায় */
  showLabel?: boolean;
  /** ৪+ chip এক সারিতে বসাতে ছোট প্যাডিং */
  compact?: boolean;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (v: T) => void;
};

export function Segmented<T extends string>({ label, showLabel, compact, value, options, onChange }: Props<T>) {
  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span aria-hidden="true" className="w-[5.5rem] shrink-0 text-sm text-muted">
          {label}
        </span>
      )}
      <div
        role="group"
        aria-label={label}
        className={`-m-1 flex min-w-0 flex-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? "gap-1.5" : "gap-2"}`}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 shrink-0 grow whitespace-nowrap rounded-full border font-medium ${compact ? "px-3" : "px-4"} ${
              value === o.value ? "border-btn-bg bg-btn-bg text-btn-tx" : "border-line bg-surface"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
