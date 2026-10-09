// ব্রাউজার-পক্ষের আপলোড/মোছা/private-খোলা (P6-২)। Cloudinary-তে সরাসরি আপলোড signed ফর্মে; secret ব্রাউজারে আসে না।
// ক্রম: sign (privileged route) → canvas-এ resize ≤২০০০px + re-encode (EXIF/GPS মুছে যায়) → Cloudinary → Firestore doc।
// Firestore-doc-id = ticket.mediaId = public_id-র শেষ অংশ ⇒ doc-তৈরি retry-নিরাপদ (idempotent create)।
import type { MediaRepo, MediaWithId } from "@/data/mediaRepo";
import { classifyFile, fitWithin, MEDIA_MAX_BYTES } from "@/lib/media";

export type UploadErrorCode = "type" | "size" | "decode" | "sign" | "upload" | "save";
export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode, readonly detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
  }
}

const IMAGE_INPUT_MAX = 40 * 1024 * 1024; // ছবি re-encode হয়ে ছোট হয়; কাঁচা ইনপুটের সীমা

async function postJson<T>(path: string, body: unknown, code: UploadErrorCode): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new UploadError(code, "network");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    throw new UploadError(code, j.detail ?? j.error ?? String(res.status));
  }
  return (await res.json()) as T;
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("toBlob"))), type, q));

/** GIF অপরিবর্তিত (অ্যানিমেশন নষ্ট না করতে); বাকি ছবি resize + re-encode */
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError("decode");
  }
  const { w, h } = fitWithin(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new UploadError("decode");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  let blob = await toBlob(c, type, 0.85);
  if (blob.size > MEDIA_MAX_BYTES) blob = await toBlob(c, "image/jpeg", 0.8);
  return blob;
}

type Ticket = { mediaId: string; publicId: string; uploadUrl: string; fields: Record<string, string> };
type CldResponse = { public_id?: string; secure_url?: string; width?: number; height?: number; bytes?: number; error?: { message?: string } };

export async function uploadMedia(repo: MediaRepo, file: File, visibility: "public" | "private"): Promise<MediaWithId> {
  const kind = classifyFile(file.name, file.type);
  if (!kind) throw new UploadError("type");
  if (file.size > (kind === "image" ? IMAGE_INPUT_MAX : MEDIA_MAX_BYTES)) throw new UploadError("size");

  const body = kind === "image" ? await prepareImage(file) : file;
  if (body.size > MEDIA_MAX_BYTES) throw new UploadError("size");

  const ticket = await postJson<Ticket>("/api/owner/media/sign", { kind, visibility }, "sign");
  const fd = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) fd.append(k, v);
  fd.append("file", body, file.name);

  let r: CldResponse;
  try {
    const res = await fetch(ticket.uploadUrl, { method: "POST", body: fd });
    r = (await res.json().catch(() => ({}))) as CldResponse;
    if (!res.ok) throw new UploadError("upload", r.error?.message ?? String(res.status));
  } catch (e) {
    throw e instanceof UploadError ? e : new UploadError("upload", "network");
  }
  if (r.public_id !== ticket.publicId) throw new UploadError("upload", "public_id মেলেনি");

  const input = {
    id: ticket.mediaId,
    cloudinaryPublicId: ticket.publicId,
    cloudinaryUrl: visibility === "public" ? r.secure_url : undefined,
    deliveryType: visibility === "public" ? ("upload" as const) : ("authenticated" as const),
    visibility,
    fileName: file.name,
    type: kind,
    size: r.bytes ?? body.size,
    ...(kind === "image" && r.width && r.height ? { width: r.width, height: r.height } : {}),
  };
  // doc-তৈরি idempotent ⇒ নিরাপদে ৩ বার
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await repo.create(input);
    } catch (e) {
      last = e;
      await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
    }
  }
  throw new UploadError("save", last instanceof Error ? last.message : "");
}

/** আগে Cloudinary asset (idempotent), সফল হলে তবেই Firestore doc — মাঝপথে ব্যর্থ হলে আবার চাপলে নিরাপদ */
export async function deleteMedia(repo: MediaRepo, m: MediaWithId): Promise<void> {
  await postJson("/api/owner/media/delete", { publicId: m.cloudinaryPublicId, kind: m.type, delivery: m.deliveryType }, "upload");
  await repo.delete(m.id);
}

export async function privateMediaUrl(m: MediaWithId): Promise<string> {
  return (await postJson<{ url: string }>("/api/owner/media/url", { publicId: m.cloudinaryPublicId, kind: m.type }, "sign")).url;
}
