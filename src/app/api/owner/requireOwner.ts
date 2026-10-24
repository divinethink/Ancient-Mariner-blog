// `/api/owner/*` handler-স্তরের owner-যাচাই (defense-in-depth): middleware.ts আগেই যাচাই করে, কিন্তু এই route-গুলো service-account/Cloudinary/GitHub-token (rules-bypass) ব্যবহার করে —
// তাই middleware ফসকালেও যেন খোলা না থাকে। একই `verifySessionToken` (duplicate যুক্তি নয়)। বৈধ হলে null, নইলে ফেরত দেওয়ার response।
import { NextResponse, type NextRequest } from "next/server";
import { getAuthEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };

export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  let env: ReturnType<typeof getAuthEnv>;
  try {
    env = getAuthEnv();
  } catch (e) {
    log.error("owner auth env misconfigured", {
      detail: (e instanceof Error ? e.message : String(e)).slice(0, 200),
    });
    return NextResponse.json({ error: "misconfigured" }, { status: 500, headers: noStore }); // fail-closed
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token, env.SESSION_SECRET, env.OWNER_UID) : null;
  return session
    ? null
    : NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
}
