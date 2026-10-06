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

// Cron (`scheduled`, P5a-৩): FIREBASE_SERVICE_ACCOUNT = Worker secret (service-account JSON, Firestore access; শুধু Cron-এ)
const cronSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
});

// build-সময়ে ডাকা হয়; মিসিং থাকলে অস্পষ্ট error নয়, স্পষ্ট বার্তা
export const getEnv = () => parse(schema);
// runtime-এ ডাকা হয় (P1a); মিসিং হলে fail-closed
export const getAuthEnv = () => parse(authSchema);
export const getSiteUrl = () => parse(siteSchema).SITE_URL;
export const getRebuildEnv = () => parse(rebuildSchema);
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
