import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { ChapterEditor } from "./ChapterEditor";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; chapterId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { projectId, chapterId } = await params;
  const { new: isNew } = await searchParams;
  if (!isValidPostId(projectId) || !isValidPostId(chapterId)) notFound();
  return <ChapterEditor projectId={projectId} chapterId={chapterId} isNew={isNew === "1"} />;
}
