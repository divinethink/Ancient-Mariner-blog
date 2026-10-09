// POST /api/owner/media/delete — Cloudinary asset মোছা (idempotent)। Firestore-doc মোছে client, এই সফলের পরে।
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { destroyAsset } from "@/data/privileged/cloudinaryAdmin";
import { guard, noStore, upstreamFail } from "../guard";

export const dynamic = "force-dynamic";
const Body = z.object({
  publicId: z.string().regex(/^blog\/[A-Za-z0-9]{1,40}$/),
  kind: z.enum(["image", "file"]),
  delivery: z.enum(["upload", "authenticated"]),
});

export async function POST(req: NextRequest) {
  const g = await guard(req, Body);
  if (!g.ok) return g.res;
  try {
    await destroyAsset(g.cfg, g.body);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return upstreamFail("delete", e);
  }
}
