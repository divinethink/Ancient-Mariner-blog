// সাইটের favicon/apple-touch-icon: build-সময়ে snapshot-এর লোগো → Cloudinary PNG → static ফাইল (Worker runtime-এ fs/snapshot নেই)।
// লোগো না থাকলে/ডাউনলোড ব্যর্থ হলে আগের স্ট্যাটিক আইকন — build কখনো ভাঙে না। dashboard/login সহ সব পেজ একই আইকন পায়।
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveCover } from "../lib/cards";
import { cldIconUrl } from "../lib/cloudinary";
import { getPublicMedia, getPublicSettings } from "./publicSnapshot";

export type IconKind = "icon" | "apple";
const SPEC = { icon: { size: 64, file: "icon-192.png" }, apple: { size: 180, file: "apple-touch-icon.png" } } as const;
export const ICON_HEADERS = { "content-type": "image/png", "cache-control": "public, max-age=3600" } as const;

export async function loadSiteIcon(kind: IconKind): Promise<Uint8Array> {
  const { size, file } = SPEC[kind];
  try {
    const [settings, media] = await Promise.all([getPublicSettings(), getPublicMedia()]);
    const logo = resolveCover(settings.design.logoMediaId || undefined, media);
    const url = logo ? cldIconUrl(logo.cloud, logo.publicId, size) : null;
    if (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) return new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    /* fallback নিচে */
  }
  return new Uint8Array(await readFile(join(process.cwd(), "public", "icons", file)));
}
