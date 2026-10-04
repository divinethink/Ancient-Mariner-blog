import { z } from "zod";
import { getEnv } from "@/config/env";
import { withRetry } from "./retry";

const HelloDoc = z.object({
  fields: z.object({ msg: z.object({ stringValue: z.string() }) }),
});

// P0a যাচাই: unauthenticated Firestore REST (server-key) দিয়ে test/hello পড়া — build-সময়ে চলে, Worker-এ নয়
export async function readHello(): Promise<string> {
  const { FIREBASE_PROJECT_ID, FIREBASE_SERVER_API_KEY } = getEnv();
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/test/hello?key=${FIREBASE_SERVER_API_KEY}`;
  const json = await withRetry(async (signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
    return res.json();
  });
  return HelloDoc.parse(json).fields.msg.stringValue;
}
