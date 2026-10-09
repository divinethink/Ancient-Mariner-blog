// mediaRepo = interface + Zod boundary (Arch §২, §৬ `media`); adapter: mediaRepo.client.ts (পথ ক, owner), mediaRepo.server.ts (পথ খ, public-REST — P6-৩)।
// ডিজাইন: doc-ID = নিজস্ব newId() (create idempotent); private ⇒ `authenticated` delivery ও cloudinaryUrl নেই। Cloudinary-র আসল asset মোছা privileged route-এর কাজ (P6-২) — এই repo শুধু Firestore মেটা।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { MediaDelivery, MediaType, MediaVisibility } from "@/lib/enums";
import { isValidPublicId } from "@/lib/cloudinary";

export const MEDIA_SCHEMA_VERSION = 1;
export const MEDIA_PAGE = 24;
export const MEDIA_TEXT_MAX = 300;

const httpsUrl = z.string().url().max(500).refine((u) => u.startsWith("https://"), "https লাগবে");
const text = z.string().trim().max(MEDIA_TEXT_MAX);

/** পড়ার schema: defensive — নতুন/optional ফিল্ড না থাকলেও ভাঙে না */
export const MediaSchema = z.object({
  cloudinaryPublicId: z.string().min(1).max(200),
  cloudinaryUrl: httpsUrl.optional(),
  deliveryType: MediaDelivery.catch("upload"),
  visibility: MediaVisibility.catch("private"), // অচেনা মান ⇒ সবচেয়ে সংরক্ষণশীল (private)
  fileName: z.string().default(""),
  type: MediaType.catch("file"),
  size: z.number().int().nonnegative().catch(0),
  width: z.number().int().positive().optional().catch(undefined), // CLS এড়াতে (Arch §৬-র additive ফিল্ড)
  height: z.number().int().positive().optional().catch(undefined),
  altText: z.string().optional(),
  caption: z.string().optional(),
  capturedAt: z.date().optional().catch(undefined),
  location: z.string().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(MEDIA_SCHEMA_VERSION),
});
export type Media = z.infer<typeof MediaSchema>;
export type MediaWithId = Media & { id: string };

export const parseMedia = (id: string, raw: Record<string, unknown>): MediaWithId => {
  const n = normalizeRaw(raw);
  // REST (পথ খ) `capturedAt` ISO-string দেয়; normalizeRaw শুধু পরিচিত তারিখ-key বদলায়
  if (typeof n.capturedAt === "string") n.capturedAt = new Date(n.capturedAt);
  return { ...MediaSchema.parse(n), id };
};

/** তৈরির schema: কঠোর — private ⇒ authenticated + URL নেই; public ⇒ upload + https URL আছে */
export const CreateMediaSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9]{1,40}$/).optional(),
    cloudinaryPublicId: z.string().refine(isValidPublicId, "অবৈধ public_id"),
    cloudinaryUrl: httpsUrl.optional(),
    deliveryType: MediaDelivery,
    visibility: MediaVisibility,
    fileName: z.string().trim().min(1).max(200),
    type: MediaType,
    size: z.number().int().nonnegative(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    altText: text.optional(),
    caption: text.optional(),
    capturedAt: z.date().optional(),
    location: text.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.visibility === "private") {
      if (v.deliveryType !== "authenticated") ctx.addIssue({ code: "custom", message: "private ⇒ authenticated" });
      if (v.cloudinaryUrl) ctx.addIssue({ code: "custom", message: "private-এ URL রাখা যাবে না" });
    } else {
      if (v.deliveryType !== "upload") ctx.addIssue({ code: "custom", message: "public ⇒ upload" });
      if (v.type === "image" && !v.cloudinaryUrl) ctx.addIssue({ code: "custom", message: "public ছবিতে URL লাগবে" });
      // public doc পাবলিক-readable (rules) ⇒ লোকেশন/তোলার-সময় রাখা নিষিদ্ধ (গোপনীয়তা)
      if (v.location || v.capturedAt) ctx.addIssue({ code: "custom", message: "public-এ location/capturedAt নয়" });
    }
  });
export type CreateMediaInput = z.input<typeof CreateMediaSchema>;

export const MediaMetaPatchSchema = z.object({ altText: text.optional(), caption: text.optional() });
export type MediaMetaPatch = z.infer<typeof MediaMetaPatchSchema>;

/** পাবলিক build-snapshot-এ যা যায় (শুধু public ছবি; location/capturedAt/fileName কখনো না — Arch §৬, rules-এর public-read) */
export const PublicMediaSchema = z.object({
  id: z.string().min(1),
  cloudinaryPublicId: z.string().refine(isValidPublicId, "অবৈধ public_id"),
  cloudinaryUrl: httpsUrl,
  width: z.number().int().positive().optional().catch(undefined),
  height: z.number().int().positive().optional().catch(undefined),
  altText: z.string().max(MEDIA_TEXT_MAX).optional().catch(undefined),
});
export type PublicMedia = z.infer<typeof PublicMediaSchema>;

/** public ছবি না হলে (বা URL ছাড়া) null */
export function toPublicMedia(m: MediaWithId): PublicMedia | null {
  if (m.visibility !== "public" || m.type !== "image" || !m.cloudinaryUrl) return null;
  const r = PublicMediaSchema.safeParse({
    id: m.id,
    cloudinaryPublicId: m.cloudinaryPublicId,
    cloudinaryUrl: m.cloudinaryUrl,
    width: m.width,
    height: m.height,
    altText: m.altText || undefined,
  });
  return r.success ? r.data : null;
}

export class MediaNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`মিডিয়া পাওয়া যায়নি: ${id}`);
    this.name = "MediaNotFoundError";
  }
}

export type MediaListOpts = { type?: MediaType; limit?: number; after?: Date };
export type MediaPage = { items: MediaWithId[]; /** পরের পাতার cursor (createdAt); শেষ হলে undefined */ next?: Date };

/** পথ ক (owner-CSR) */
export interface MediaRepo {
  /** নতুন আগে, cursor-paginated (`MEDIA_PAGE`) */
  list(opts?: MediaListOpts): Promise<MediaPage>;
  get(id: string): Promise<MediaWithId | null>;
  /** idempotent: একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত (retry/double-tap-এ duplicate নয়) */
  create(input: CreateMediaInput): Promise<MediaWithId>;
  /** শুধু altText/caption; অন্য ফিল্ড বদলায় না */
  updateMeta(id: string, patch: MediaMetaPatch): Promise<MediaWithId>;
  /** শুধু Firestore doc; না থাকলেও সফল। Cloudinary asset মোছা P6-২-র privileged route */
  delete(id: string): Promise<void>;
}
