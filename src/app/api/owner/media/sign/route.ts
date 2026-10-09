// POST /api/owner/media/sign — আপলোডের স্বাক্ষর (Arch §২ privileged ৪)। body: {kind, visibility}
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createUploadTicket } from "@/data/privileged/cloudinaryAdmin";
import { guard, noStore, upstreamFail } from "../guard";

export const dynamic = "force-dynamic";
const Body = z.object({ kind: z.enum(["image", "file"]), visibility: z.enum(["public", "private"]) });

export async function POST(req: NextRequest) {
  const g = await guard(req, Body);
  if (!g.ok) return g.res;
  try {
    const t = await createUploadTicket(g.cfg, g.body);
    return NextResponse.json(t, { headers: noStore });
  } catch (e) {
    return upstreamFail("sign", e);
  }
}
