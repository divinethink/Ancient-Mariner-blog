import { parseShare } from "@/lib/shareTarget";
import { ShareToInbox } from "./ShareToInbox";

// manifest `share_target` গন্তব্য (Android installed PWA)। লগইন না থাকলে middleware /login-এ পাঠিয়ে `next`-এ ফেরায়।
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ShareToInbox initial={parseShare(await searchParams)} />;
}
