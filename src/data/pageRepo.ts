// pageRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: pageRepo.client.ts (পথ ক), pageRepo.server.ts (পথ খ)।
// doc-ID = slug (অপরিবর্তনীয়; বদলাতে নতুন পেজ বানিয়ে পুরনোটা মোছা — Arch §৬)। Zod শুধু shell field validate করে; body-র কাঠামো renderer/editor-এ।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { PageStatus } from "@/lib/enums";
import { PAGE_SCHEMA_VERSION, PAGE_TITLE_MAX } from "@/lib/pages";

const MAX_BODY_BYTES = 900 * 1024; // UTF-8 byte — posts-এর সাথে একই সীমা (Arch §৬)
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;
export const PageBody = z.string().refine((s) => utf8Bytes(s) <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে");
export const PageTitle = z.string().trim().max(PAGE_TITLE_MAX);

export const PageSchema = z.object({
  title: PageTitle,
  body: PageBody,
  status: PageStatus,
  system: z.boolean().default(false),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(PAGE_SCHEMA_VERSION),
});
export type Page = z.infer<typeof PageSchema>;
export type PageWithId = Page & { slug: string };

export const parsePage = (slug: string, raw: Record<string, unknown>): PageWithId => ({
  ...PageSchema.parse(normalizeRaw(raw)),
  slug,
});

export type CreatePageInput = { slug: string; title: string; body: string; status: PageStatus };
export type UpdatePageInput = { title?: string; body?: string; status?: PageStatus };

export class PageExistsError extends Error {
  constructor(public readonly slug: string) {
    super(`এই slug-এ পেজ আছে: ${slug}`);
    this.name = "PageExistsError";
  }
}
export class PageNotFoundError extends Error {
  constructor(public readonly slug: string) {
    super(`পাওয়া যায়নি: ${slug}`);
    this.name = "PageNotFoundError";
  }
}
export class PageRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageRuleError";
  }
}

/** পথ ক (owner-CSR) */
export interface PageRepo {
  /** সব পেজ; সংখ্যা ছোট — limit নেই। system আগে, তারপর শিরোনাম-ক্রমে */
  list(): Promise<PageWithId[]>;
  get(slug: string): Promise<PageWithId | null>;
  /** বিদ্যমান slug-এ PageExistsError (transaction-এ যাচাই); reserved/অবৈধ slug PageRuleError */
  create(input: CreatePageInput): Promise<PageWithId>;
  update(slug: string, patch: UpdatePageInput): Promise<PageWithId>;
  /** system পেজ PageRuleError (rules-ও আটকায়) */
  remove(slug: string): Promise<void>;
  /** `about`/`privacy` না থাকলে Draft হিসেবে বানায়; বিদ্যমান অক্ষত (idempotent)। নতুন বানানো সংখ্যা ফেরত */
  ensureSystemPages(): Promise<number>;
}

/** পথ খ (build-সময়ে unauthenticated REST) — শুধু published */
export interface PublicPageSource {
  listPublished(): Promise<PageWithId[]>;
}
