import { bn } from "@/i18n/bn";
import { isFollowItAction } from "@/lib/siteSettings";

/**
 * ইমেইল-সাবস্ক্রাইব ফর্ম (follow.it): সাধারণ HTML form — JS/iframe/script নেই, static পেজেই বসে।
 * জমা দিলে ইমেইল সরাসরি follow.it-এ যায় (পাবলিক CSP `form-action` শুধু api.follow.it-কে দেয়); আমাদের সার্ভারে কিছু জমা হয় না।
 * `action` খালি/অবৈধ হলে কিছুই দেখায় না (fail-closed)। variant: "side" = শুধু ইমেইল-ঘর + বোতাম (বক্সের শিরোনাম আগে থেকেই আছে); "post" = লেখার শেষে ছোট শিরোনামসহ কার্ড।
 */
export function SubscribeBox({ action, id, variant = "side" }: { action: string | undefined; id: string; variant?: "side" | "post" }) {
  const a = (action ?? "").trim();
  if (!isFollowItAction(a)) return null;
  const inputId = `sub-email-${id}`;
  const post = variant === "post";
  return (
    <form
      action={a}
      method="post"
      target="_blank"
      aria-label={bn.public.subscribeTitle}
      className={post ? "mt-10 rounded-2xl border border-line bg-surface p-4" : ""}
    >
      {post && <p className="font-serif font-bold">{bn.public.subscribeTitle}</p>}
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
        className={`${post ? "mt-3 " : ""}min-h-11 w-full rounded-lg border border-line bg-bg px-3`}
      />
      <button type="submit" className="mt-2 min-h-11 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx">
        {bn.public.subscribeCta}
      </button>
    </form>
  );
}
