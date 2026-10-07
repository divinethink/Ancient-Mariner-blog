import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { PreviewPanel } from "./PreviewPanel";

// owner-প্রিভিউ: CSR (পথ ক), `middleware.ts`-সুরক্ষিত; সার্চ-ইঞ্জিনের বাইরে (Arch §১৭ P4a)
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PostPreviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!isValidPostId(postId)) notFound();
  return <PreviewPanel postId={postId} />;
}
