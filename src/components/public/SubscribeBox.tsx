import { bn } from "@/i18n/bn";
import { isFollowItAction, isFollowItPage } from "@/lib/siteSettings";

/**
 * ইমেইল-সাবস্ক্রাইব (follow.it)। অগ্রাধিকার: (১) ফর্ম-ঠিকানা থাকলে ইনলাইন ফর্ম (ইমেইল-ঘর + বোতাম এক সারিতে; জায়গা কম) —
 * সাধারণ HTML form, JS/iframe/script নেই; জমা দিলে ইমেইল সরাসরি follow.it-এ যায় (CSP `form-action` শুধু api.follow.it),
 * আমাদের সার্ভারে কিছু জমা হয় না; (২) নইলে সাবস্ক্রাইব-পেজের লিংক থাকলে বোতাম; (৩) কিছুই না থাকলে/অবৈধ হলে কিছু দেখায় না (fail-closed)।
 * variant: "side" = বক্সের শিরোনাম আগে থেকেই আছে; "post" = লেখার শেষে ছোট শিরোনামসহ কার্ড।
 */
export function SubscribeBox({
  action,
  link,
  id,
  variant = "side",
}: {
  action: string | undefined;
  link?: string | undefined;
  id: string;
  variant?: "side" | "post";
}) {
  const a = (action ?? "").trim();
  const l = (link ?? "").trim();
  const post = variant === "post";

  if (isFollowItAction(a)) {
    const inputId = `sub-email-${id}`;
    return (
      <form
        action={a}
        method="post"
        target="_blank"
        aria-label={bn.public.subscribeTitle}
        className={post ? "mt-8 rounded-2xl border border-line bg-surface p-4" : ""}
      >
        {post && <p className="mb-2 font-serif font-bold">{bn.public.subscribeTitle}</p>}
        <label htmlFor={inputId} className="sr-only">
          {bn.public.subscribeEmail}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={inputId}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={bn.public.subscribeEmail}
            className="min-h-11 min-w-0 flex-[1_1_9rem] rounded-lg border border-line bg-bg px-3"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx">
            {bn.public.subscribeCta}
          </button>
        </div>
      </form>
    );
  }

  if (isFollowItPage(l)) {
    const btn = (
      <a
        href={l}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-btn-bg px-5 font-semibold text-btn-tx"
      >
        {bn.public.subscribeLinkCta}
      </a>
    );
    return post ? <div className="mt-6">{btn}</div> : btn;
  }
  return null;
}
