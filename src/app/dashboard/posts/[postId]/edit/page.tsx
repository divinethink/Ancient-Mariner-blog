import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { PostEditor } from "./PostEditor";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ new?: string; tpl?: string }>;
}) {
  const { postId } = await params;
  const { new: isNew, tpl } = await searchParams;
  if (!isValidPostId(postId)) notFound();
  return <PostEditor postId={postId} isNew={isNew === "1"} tpl={isNew === "1" ? (tpl ?? null) : null} />;
}
