import { z } from "zod";

const schema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVER_API_KEY: z.string().min(1),
  SITE_URL: z.url(),
});

// build-সময়ে ডাকা হয়; মিসিং থাকলে অস্পষ্ট error নয়, স্পষ্ট বার্তা
export function getEnv() {
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const keys = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env মিসিং/ভুল: ${keys}`);
  }
  return r.data;
}
