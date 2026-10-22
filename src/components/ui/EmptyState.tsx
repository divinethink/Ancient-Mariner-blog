import { Icon, type IconName } from "@/components/icons";

/** ফাঁকা তালিকার একরকম চেহারা: আইকন + এক লাইন নির্দেশনা (dashboard) */
export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
      <Icon name={icon} size={28} strokeWidth={1.6} />
      <p>{text}</p>
    </div>
  );
}
