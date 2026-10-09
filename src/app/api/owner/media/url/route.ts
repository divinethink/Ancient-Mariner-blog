// POST /api/owner/media/url — private ফাইলের ৫-মিনিটের download-URL (শুধু owner)
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { privateDownloadUrl } from "@/data/privileged/cloudinaryAdmin";
import { guard, noStore, upstreamFail } from "../guard";

export const dynamic = "force-dynamic";
const Body = z.object({ publicId: z.string().regex(/^blog\/[A-Za-z0-9]{1,40}$/), kind: z.enum(["image", "file"]) });

export async function POST(req: NextRequest) {
  const g = await guard(req, Body);
  if (!g.ok) return g.res;
  try {
    return NextResponse.json({ url: await privateDownloadUrl(g.cfg, g.body) }, { headers: noStore });
  } catch (e) {
    return upstreamFail("url", e);
  }
}
