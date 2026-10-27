// দিনলিপির পরিসংখ্যান-টাইল (পাবলিক ও ড্যাশবোর্ড): হুক/state নেই। `solid` = রঙিন (পাবলিক), `soft` = হালকা (ড্যাশবোর্ড)।
const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

export function DiaryTiles({ items, tone = "solid" }: { items: readonly { n: number; label: string }[]; tone?: "solid" | "soft" }) {
  const cls = tone === "solid" ? "bg-btn-bg text-btn-tx" : "border border-line bg-surface";
  return (
    <ul className="mt-3 grid list-none grid-cols-3 gap-2 p-0">
      {items.map((it) => (
        <li key={it.label} className={`rounded-2xl px-2 py-2.5 text-center ${cls}`}>
          <b className="block font-serif text-2xl leading-tight">{bnNum(it.n)}</b>
          <span className="text-xs opacity-90">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
