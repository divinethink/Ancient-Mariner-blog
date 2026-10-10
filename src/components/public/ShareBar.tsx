import { CopyLink } from "@/components/public/ReaderTools";
import { bn } from "@/i18n/bn";
import { facebookShareUrl } from "@/lib/reader";

/** শেয়ার-বার: Facebook (সাধারণ লিংক, JS ছাড়াই চলে) + লিংক-কপি। URL না থাকলে (লোকাল dev) কিছুই নয়। */
export function ShareBar({ url }: { url: string | undefined }) {
  const fb = facebookShareUrl(url);
  if (!url || !fb) return null;
  return (
    <section aria-label={bn.public.shareLabel} className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <span className="text-sm text-muted">{bn.public.shareLabel}</span>
      <a href={fb} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-accent-text">
        Facebook
      </a>
      <CopyLink url={url} />
    </section>
  );
}
