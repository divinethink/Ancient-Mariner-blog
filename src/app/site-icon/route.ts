import { ICON_HEADERS, loadSiteIcon } from "@/data/siteIcon";

// build-সময়ে একবার তৈরি (static); লোগো বদলালে নতুন deploy-এ হালনাগাদ
export const dynamic = "force-static";

export async function GET() {
  return new Response(Buffer.from(await loadSiteIcon("icon")), { headers: ICON_HEADERS });
}
