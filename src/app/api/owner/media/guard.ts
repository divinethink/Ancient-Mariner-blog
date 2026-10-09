// `/api/owner/media/*` সাধারণ প্রহরী: env, Origin (CSRF), ছোট JSON body। `middleware.ts` আগেই owner-session যাচাই করে।
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getCloudinaryEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/session";

export const noStore = { "Cache-Control": "no-store" };
const log = createLogger();

export type Cld = { cloudName: string; apiKey: string; apiSecret: string };

export async function guard<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<{ ok: true; cfg: Cld; body: z.infer<S> } | { ok: false; res: NextResponse }> {
  const fail = (status: number, error: string, detail?: string) => ({
    ok: false as const,
    res: NextResponse.json(detail ? { error, detail } : { error }, { status, headers: noStore }),
  });
  let env: ReturnType<typeof getCloudinaryEnv>;
  try {
    env = getCloudinaryEnv();
  } catch (e) {
    const detail = (e instanceof Error ? e.message : String(e)).slice(0, 200); // শুধু মিসিং key-এর নাম
    log.error("media env misconfigured", { detail });
    return fail(500, "misconfigured", detail);
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) return fail(403, "forbidden");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 4096) return fail(413, "too_large");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request");
  return {
    ok: true,
    cfg: { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET },
    body: parsed.data,
  };
}

export function upstreamFail(what: string, e: unknown): NextResponse {
  const detail = (e instanceof Error ? e.message : String(e)).slice(0, 200);
  log.error(`media ${what} failed`, { detail });
  return NextResponse.json({ error: "upstream_failed", detail }, { status: 502, headers: noStore });
}
