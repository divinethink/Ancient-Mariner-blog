import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { HistoryPanel } from "./HistoryPanel";

export default async function PostHistoryPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!isValidPostId(postId)) notFound();
  return <HistoryPanel postId={postId} />;
}
