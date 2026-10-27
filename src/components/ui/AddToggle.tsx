import { Icon } from "@/components/icons";

/** ফর্ম লুকানো অবস্থায় দেখানো বড় "＋ নতুন …" বাটন; চাপলে ফর্ম খোলে (state বাইরে) */
export function AddToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-base font-semibold text-accent-text hover:bg-line"
    >
      <Icon name="plus" size={20} strokeWidth={2.2} />
      {label}
    </button>
  );
}
