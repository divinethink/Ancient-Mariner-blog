// Privileged allowlist ৪ (Arch §২): Cloudinary upload-signature, asset মোছা, private-ফাইলের স্বল্পমেয়াদি download-URL (P6-২)।
// শুধু `app/**/route.ts` থেকে import (ESLint)। API secret এই ফাইলের বাইরে যায় না; response-এ secret/স্বাক্ষরের উপাদান ফেরে না।
import { signParams } from "@/lib/cloudinarySign";
import { newId } from "@/lib/id";
import { withRetry } from "../retry";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
  /** পরীক্ষার জন্য: বর্তমান সময় (সেকেন্ড, UTC) */
  nowSec?: () => number;
};
export type MediaKind = "image" | "file";
export type Delivery = "upload" | "authenticated";

const PUBLIC_ID_RE = /^blog\/[A-Za-z0-9]{1,40}$/;
export const ALLOWED_IMAGE_FORMATS = "jpg,jpeg,png,webp,gif";

export const resourceTypeOf = (k: MediaKind): "image" | "raw" => (k === "image" ? "image" : "raw");
const now = (c: CloudinaryConfig) => (c.nowSec ? c.nowSec() : Math.floor(Date.now() / 1000));
const api = (c: CloudinaryConfig, kind: MediaKind, action: string) =>
  `https://api.cloudinary.com/v1_1/${c.cloudName}/${resourceTypeOf(kind)}/${action}`;

export class CloudinaryError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`Cloudinary ${status}${detail ? `: ${detail}` : ""}`);
  }
}

export type UploadTicket = {
  mediaId: string;
  publicId: string;
  uploadUrl: string;
  /** browser-এর multipart-এ `file`-এর সাথে হুবহু এই ফিল্ডগুলো যায় */
  fields: Record<string, string>;
};

/** doc-ID = public_id-র শেষ অংশ (`blog/<mediaId>`) ⇒ আপলোড ও Firestore-doc একই id-তে বাঁধা, retry-নিরাপদ */
export async function createUploadTicket(
  cfg: CloudinaryConfig,
  o: { kind: MediaKind; visibility: "public" | "private"; mediaId?: string },
): Promise<UploadTicket> {
  const mediaId = o.mediaId ?? newId();
  const publicId = `blog/${mediaId}`;
  if (!PUBLIC_ID_RE.test(publicId)) throw new Error("অবৈধ mediaId");
  const signed: Record<string, string | number> = {
    public_id: publicId,
    timestamp: now(cfg),
    type: o.visibility === "private" ? "authenticated" : "upload",
  };
  if (o.kind === "image") signed.allowed_formats = ALLOWED_IMAGE_FORMATS; // সার্ভার-পক্ষে ফরম্যাট আটকায়
  const signature = await signParams(signed, cfg.apiSecret);
  const fields: Record<string, string> = { api_key: cfg.apiKey, signature };
  for (const [k, v] of Object.entries(signed)) fields[k] = String(v);
  return { mediaId, publicId, uploadUrl: api(cfg, o.kind, "upload"), fields };
}

/** idempotent: asset আগেই না থাকলেও সফল (`not found`) */
export async function destroyAsset(
  cfg: CloudinaryConfig,
  o: { publicId: string; kind: MediaKind; delivery: Delivery },
): Promise<void> {
  if (!PUBLIC_ID_RE.test(o.publicId)) throw new Error("অবৈধ public_id");
  const f = cfg.fetchImpl ?? fetch;
  const body = async () => {
    const signed = { invalidate: "true", public_id: o.publicId, timestamp: now(cfg), type: o.delivery };
    const signature = await signParams(signed, cfg.apiSecret);
    return new URLSearchParams({ ...Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)])), api_key: cfg.apiKey, signature });
  };
  await withRetry(async (signal) => {
    const res = await f(api(cfg, o.kind, "destroy"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: await body(), // প্রতি চেষ্টায় নতুন timestamp
      signal,
    });
    const j = (await res.json().catch(() => ({}))) as { result?: string; error?: { message?: string } };
    if (res.ok && (j.result === "ok" || j.result === "not found")) return;
    throw new CloudinaryError(res.status, j.error?.message ?? j.result ?? "");
  });
}

/** private (authenticated) ফাইলের জন্য স্বল্পমেয়াদি (ডিফল্ট ৫ মিনিট) download-URL — Cloudinary `private_download_url` */
export async function privateDownloadUrl(
  cfg: CloudinaryConfig,
  o: { publicId: string; kind: MediaKind; ttlSec?: number },
): Promise<string> {
  if (!PUBLIC_ID_RE.test(o.publicId)) throw new Error("অবৈধ public_id");
  const t = now(cfg);
  const signed: Record<string, string | number> = {
    expires_at: t + (o.ttlSec ?? 300),
    public_id: o.publicId,
    timestamp: t,
    type: "authenticated",
  };
  if (o.kind === "image") signed.format = "jpg"; // ছবি: যেকোনো মূল ফরম্যাট jpg-তে নামে; raw-তে format নেই
  const signature = await signParams(signed, cfg.apiSecret);
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)])), api_key: cfg.apiKey, signature });
  return `${api(cfg, o.kind, "download")}?${qs.toString()}`;
}
