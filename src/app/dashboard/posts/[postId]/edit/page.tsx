import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { PostEditor } from "./PostEditor";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { postId } = await params;
  const { new: isNew } = await searchParams;
  if (!isValidPostId(postId)) notFound();
  return <PostEditor postId={postId} isNew={isNew === "1"} />;
}
