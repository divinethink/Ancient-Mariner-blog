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

function parse<T extends z.ZodType>(s: T): z.infer<T> {
  const r = s.safeParse(process.env);
  if (!r.success) {
    const keys = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env মিসিং/ভুল: ${keys}`);
  }
  return r.data;
}

// build-সময়ে ডাকা হয়; মিসিং থাকলে অস্পষ্ট error নয়, স্পষ্ট বার্তা
export const getEnv = () => parse(schema);
// runtime-এ ডাকা হয় (P1a); মিসিং হলে fail-closed
export const getAuthEnv = () => parse(authSchema);
