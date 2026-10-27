// tripRepo = interface + Zod boundary; adapter: tripRepo.client.ts (পথ ক, owner-CSR)। ঘোরার তালিকা (দিনলিপি-চ): শুধু owner, পাবলিক read নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { TripStatus } from "@/lib/enums";
import { TRIP_COST_MAX, TRIP_NOTE_MAX, TRIP_PLACE_MAX } from "@/lib/trips";
import { isDayKey } from "@/lib/books";

export const TRIP_SCHEMA_VERSION = 1;

export const TripPlaceSchema = z.string().trim().min(1).max(TRIP_PLACE_MAX);
export const TripNoteSchema = z.string().trim().max(TRIP_NOTE_MAX);
export const TripCostSchema = z.number().int().min(0).max(TRIP_COST_MAX);
const DaySchema = z.string().refine(isDayKey);

export const TripSchema = z.object({
  place: z.string().default(""),
  status: TripStatus.catch("wish"),
  note: z.string().default(""),
  /** খরচ = পূর্ণসংখ্যা টাকা */
  costTaka: TripCostSchema.optional().catch(undefined),
  /** কবে গিয়েছি (দিন-key) */
  day: DaySchema.optional().catch(undefined),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(TRIP_SCHEMA_VERSION),
});
export type Trip = z.infer<typeof TripSchema>;
export type TripWithId = Trip & { id: string };

export const parseTrip = (id: string, raw: Record<string, unknown>): TripWithId => ({
  ...TripSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateTripInput = {
  /** retry/double-submit-নিরাপত্তা (একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত) */
  id?: string;
  place: string;
  /** বিস্তারিত (ঐচ্ছিক) — `note` ফিল্ডেই যায়, নতুন ফিল্ড নয় */
  note?: string;
  status: TripStatus;
  day?: string;
};
/** `costTaka: null` = খরচ মুছুন */
export type TripPatch = {
  place?: string;
  status?: TripStatus;
  note?: string;
  costTaka?: number | null;
  day?: string;
};

export class TripNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`ট্রিপ পাওয়া যায়নি: ${id}`);
    this.name = "TripNotFoundError";
  }
}

/** পথ ক (owner-CSR) */
export interface TripRepo {
  /** সাম্প্রতিক-সম্পাদনা আগে; সর্বোচ্চ ৩০০ */
  list(): Promise<TripWithId[]>;
  create(input: CreateTripInput): Promise<TripWithId>;
  /** idempotent */
  update(id: string, patch: TripPatch): Promise<TripWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
