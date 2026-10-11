import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { HistoryPanel } from "../../../../../posts/[postId]/history/HistoryPanel";

export default async function ChapterHistoryPage({ params }: { params: Promise<{ projectId: string; chapterId: string }> }) {
  const { projectId, chapterId } = await params;
  if (!isValidPostId(projectId) || !isValidPostId(chapterId)) notFound();
  return <HistoryPanel postId={chapterId} chapterOf={projectId} />;
}
