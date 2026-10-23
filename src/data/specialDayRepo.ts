// specialDayRepo = interface + Zod boundary; adapter: specialDayRepo.client.ts (পথ ক)। বিশেষ দিন (দিনলিপি-চ): শুধু owner, পাবলিক read নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { SpecialDayKind } from "@/lib/enums";
import { SPECIAL_NAME_MAX, SPECIAL_YEAR_MAX, SPECIAL_YEAR_MIN, validMonthDay } from "@/lib/specialDays";

export const SPECIAL_DAY_SCHEMA_VERSION = 1;

export const SpecialNameSchema = z.string().trim().min(1).max(SPECIAL_NAME_MAX);
export const SpecialYearSchema = z.number().int().min(SPECIAL_YEAR_MIN).max(SPECIAL_YEAR_MAX);

export const SpecialDaySchema = z
  .object({
    name: z.string().default(""),
    kind: SpecialDayKind.catch("other"),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** জন্ম/শুরুর বছর (ঐচ্ছিক; বয়স/বার্ষিকী গোনার জন্য) */
    year: SpecialYearSchema.optional().catch(undefined),
    ownerUid: z.string().min(1),
    createdAt: z.date(),
    updatedAt: z.date(),
    schemaVersion: z.number().int().default(SPECIAL_DAY_SCHEMA_VERSION),
  })
  .refine((d) => validMonthDay(d.month, d.day));
export type SpecialDay = z.infer<typeof SpecialDaySchema>;
export type SpecialDayWithId = SpecialDay & { id: string };

export const parseSpecialDay = (id: string, raw: Record<string, unknown>): SpecialDayWithId => ({
  ...SpecialDaySchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateSpecialDayInput = {
  /** retry/double-submit-নিরাপত্তা */
  id?: string;
  name: string;
  kind: SpecialDayKind;
  month: number;
  day: number;
  year?: number;
};

/** পথ ক (owner-CSR) */
export interface SpecialDayRepo {
  /** সব (সর্বোচ্চ ২০০); আসন্ন-ক্রম UI-তে (`lib/specialDays`) */
  list(): Promise<SpecialDayWithId[]>;
  create(input: CreateSpecialDayInput): Promise<SpecialDayWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
