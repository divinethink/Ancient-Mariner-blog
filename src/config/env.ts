import { z } from "zod";

const schema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVER_API_KEY: z.string().min(1),
  SITE_URL: z.url(),
});

// Worker runtime (middleware/auth route): Worker secret হিসেবে সেট (README)
const authSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  SITE_URL: z.url(),
  OWNER_UID: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});

function parse<T extends z.ZodType>(s: T, source: unknown = process.env): z.infer<T> {
  const r = s.safeParse(source);
  if (!r.success) {
    const keys = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env মিসিং/ভুল: ${keys}`);
  }
  return r.data;
}

// পাবলিক পেজ build-সময়ে canonical-এর জন্য (CI `next build`-এও SITE_URL থাকে; না থাকলে কলার ধরে)
const siteSchema = z.object({ SITE_URL: z.url() });

// `/api/owner/rebuild` (Worker runtime): GitHub workflow_dispatch — GITHUB_TOKEN Worker secret, GITHUB_REPO `wrangler.jsonc` vars
const rebuildSchema = z.object({
  SITE_URL: z.url(),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
});

// Cloudinary privileged routes (`/api/owner/media/*`, P6-২): CLOUD_NAME/API_KEY = `wrangler.jsonc` vars; API_SECRET = শুধু Worker secret
const cloudinarySchema = z.object({
  SITE_URL: z.url(),
  CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,59}$/i),
  CLOUDINARY_API_KEY: z.string().regex(/^\d{6,20}$/),
  CLOUDINARY_API_SECRET: z.string().min(10),
});

// `POST /api/view` (P11a-১): VIEW_HASH_SALT = শুধু Worker secret (দৈনিক dedupe-hash-এর salt); SITE_TIMEZONE ঐচ্ছিক `wrangler.jsonc` var (দিন-গণনা; না থাকলে Asia/Dhaka)
const viewSchema = z.object({
  SITE_URL: z.url(),
  VIEW_HASH_SALT: z.string().min(16),
  SITE_TIMEZONE: z.string().min(1).default("Asia/Dhaka"),
});

// Cron (`scheduled`, P5a-৩): FIREBASE_SERVICE_ACCOUNT = Worker secret (service-account JSON, Firestore access; শুধু Cron-এ)
const cronSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
  // P11c-১: scheduled-publish-এর পর rebuild trigger; না থাকলে ৩-ঘণ্টার `deploy.yml` schedule-ই তুলে নেয় (দেরি, ক্ষতি নয়)
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
});

// `/share/[token]` পেজ (Worker runtime, P11c-২): service-account দিয়ে সংকীর্ণ doc-get; Cron-এর সমান secret
const shareSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
});
export const getShareEnv = () => parse(shareSchema);

// build-সময়ে ডাকা হয়; মিসিং থাকলে অস্পষ্ট error নয়, স্পষ্ট বার্তা
export const getEnv = () => parse(schema);
// runtime-এ ডাকা হয় (P1a); মিসিং হলে fail-closed
export const getAuthEnv = () => parse(authSchema);
export const getSiteUrl = () => parse(siteSchema).SITE_URL;
export const getRebuildEnv = () => parse(rebuildSchema);
export const getCloudinaryEnv = () => parse(cloudinarySchema);
export const getViewEnv = () => parse(viewSchema);
/** `scheduled` handler-এর নিজস্ব `env` দিয়ে (process.env-এর ওপর নির্ভর না করে); মিসিং হলে fail-closed */
export const getCronEnv = (source: unknown) => parse(cronSchema, source);

// Drive backup job (`scripts/backup.ts`, GitHub Actions; P5b-২): সব GitHub secrets। OWNER_UID ঐচ্ছিক (না থাকলে পড়া doc থেকে)
const backupJobSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().min(1),
  BACKUP_TYPE: z.enum(["auto", "manual"]).default("manual"),
  OWNER_UID: z.string().optional(),
});
export const getBackupJobEnv = (source: unknown = process.env) => parse(backupJobSchema, source);
