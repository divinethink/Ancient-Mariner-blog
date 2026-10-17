import { cldSrcSet, cldUrl } from "@/lib/cloudinary";
import type { CoverView } from "@/lib/cards";
import { cropStyle } from "@/lib/coverCrop";

/**
 * cover-ছবি (server/client দুই জায়গায়, hook নেই)। CLS এড়াতে সবসময় জায়গা আগে থেকে ধরা:
 * - fill (card/featured): কন্টেইনার-aspect-এ object-cover; কন্টেইনার caller-এর (relative + আকার)।
 * - natural (article): মূল w/h জানা থাকলে সেই অনুপাতে, নইলে 16:9 object-cover।
 * Cloudinary URL অবৈধ হলে null — caller-এর fallback (gradient/অক্ষর) থাকে।
 */
export function Cover({
  cover,
  sizes,
  mode = "fill",
  priority = false,
  className = "",
}: {
  cover: CoverView;
  sizes: string;
  mode?: "fill" | "natural";
  priority?: boolean;
  className?: string;
}) {
  const src = cldUrl(cover.cloud, cover.publicId, { w: 800 });
  if (!src) return null;
  const srcSet = cldSrcSet(cover.cloud, cover.publicId, cover.w ?? 2000) ?? undefined;
  const crop = cropStyle(cover.crop);
  // ক্রপ থাকলে article-এ aspect-ratio নিজেই ধরে (object-cover); নইলে মূল অনুপাত
  const natural = mode === "natural" && cover.w && cover.h && !cover.crop;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-ই optimizer (f_auto,q_auto,srcset); next/image বন্ধ (Arch §১২)
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={cover.alt}
      style={mode === "natural" ? crop : { objectPosition: crop.objectPosition }}
      {...(natural ? { width: cover.w, height: cover.h } : {})}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={
        natural
          ? `h-auto w-full ${className}`
          : mode === "natural"
            ? `${cover.crop ? "" : "aspect-video "} w-full object-cover ${className}`
            : `absolute inset-0 h-full w-full object-cover ${className}`
      }
    />
  );
}
