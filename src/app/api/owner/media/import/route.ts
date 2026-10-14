// POST /api/owner/media/import — বাইরের ছবির URL ⇒ Cloudinary-তে আমদানি (ওয়ার্ডপ্রেস/ব্লগ থেকে কপি-পেস্টের ছবি)। body: {url}
// owner-session middleware-এ, Origin/size guard-এ; ছবি Cloudinary নিজে নামায় (data/privileged/cloudinaryAdmin)।
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { importRemoteImage } from "@/data/privileged/cloudinaryAdmin";
import { guard, noStore, upstreamFail } from "../guard";

export const dynamic = "force-dynamic";
const Body = z.object({
  url: z
    .string()
    .max(2000)
    .refine((s) => {
      try {
        const p = new URL(s);
        return (p.protocol === "https:" || p.protocol === "http:") && !p.username && !p.password;
      } catch {
        return false;
      }
    }, "অবৈধ URL"),
});

export async function POST(req: NextRequest) {
  const g = await guard(req, Body);
  if (!g.ok) return g.res;
  try {
    return NextResponse.json(await importRemoteImage(g.cfg, { url: g.body.url }), { headers: noStore });
  } catch (e) {
    return upstreamFail("import", e);
  }
}
