"use client";

// ড্যাশবোর্ডের দিনলিপি-কার্ডে ছবি (পোলারয়েড): body-র media-id থেকে মেটা এনে। শুধু read; ব্যর্থ/অনুপস্থিত ছবি চুপচাপ বাদ।
import { useEffect, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";

export function DiaryThumbs({ ids }: { ids: readonly string[] }) {
  const key = ids.join(",");
  const [items, setItems] = useState<MediaWithId[]>([]);
  useEffect(() => {
    let dead = false;
    if (key === "") return;
    void (async () => {
      try {
        const repo = await getMediaRepo();
        const got = await Promise.all(key.split(",").map((id) => repo.get(id).catch(() => null)));
        if (!dead) setItems(got.filter((m): m is MediaWithId => m !== null));
      } catch {
        /* ছবি ছাড়াই চলে */
      }
    })();
    return () => {
      dead = true;
    };
  }, [key]);
  const shown = key === "" ? [] : items;
  if (shown.length === 0) return null;
  return (
    <div className="reading" aria-hidden="false">
      {shown.map((m) => {
        const cloud = cloudFromUrl(m.cloudinaryUrl);
        const src = cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 480 }) : null;
        if (!src) return null;
        return (
          <figure key={m.id} className="reading-figure">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-ই optimizer; next/image বন্ধ */}
            <img src={src} alt={m.altText ?? ""} loading="lazy" decoding="async" />
          </figure>
        );
      })}
    </div>
  );
}
