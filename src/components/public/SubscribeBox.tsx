import { bn } from "@/i18n/bn";
import { isFollowItAction } from "@/lib/siteSettings";

/**
 * ইমেইল-সাবস্ক্রাইব ফর্ম (follow.it): সাধারণ HTML form — JS/iframe/script নেই, static পেজেই বসে।
 * জমা দিলে ইমেইল সরাসরি follow.it-এ যায় (পাবলিক CSP `form-action` শুধু api.follow.it-কে দেয়); আমাদের সার্ভারে কিছু জমা হয় না।
 * `action` খালি/অবৈধ হলে কিছুই দেখায় না (fail-closed)।
 */
export function SubscribeBox({ action, id, boxed = true }: { action: string | undefined; id: string; boxed?: boolean }) {
  const a = (action ?? "").trim();
  if (!isFollowItAction(a)) return null;
  const inputId = `sub-email-${id}`;
  return (
    <form
      action={a}
      method="post"
      target="_blank"
      aria-label={bn.public.subscribeTitle}
      className={boxed ? "mt-10 rounded-2xl border border-line bg-surface p-4" : ""}
    >
      <p className="font-serif font-bold">{bn.public.subscribeTitle}</p>
      <p className="mt-1 text-sm text-muted">{bn.public.subscribeText}</p>
      <label htmlFor={inputId} className="sr-only">
        {bn.public.subscribeEmail}
      </label>
      <input
        id={inputId}
        type="email"
        name="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder={bn.public.subscribeEmail}
        className="mt-3 min-h-11 w-full rounded-lg border border-line bg-bg px-3"
      />
      <button type="submit" className="mt-2 min-h-11 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx">
        {bn.public.subscribeCta}
      </button>
      <p className="mt-2 text-xs text-muted">{bn.public.subscribeNote}</p>
    </form>
  );
}
