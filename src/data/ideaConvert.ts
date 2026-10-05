// Idea → Post convert (Arch §১৭ P3b)। idempotent: পোস্ট-id = আইডিয়া-id (নির্ধারিত), তাই retry/double-tap-এ দ্বিতীয় পোস্ট হয় না;
// `convertedToPostId` বসলে আবার convert = বিদ্যমান পোস্ট খোলা। দুই ধাপের মাঝে থামলেও আবার চালালে বাকিটা সম্পূর্ণ হয়।
// শুধু interface-এ নির্ভর (SDK-মুক্ত) — fake দিয়ে unit-test করা যায়।
import { IdeaNotFoundError, type IdeaRepo } from "@/data/ideaRepo";
import type { PostRepo } from "@/data/postRepo";
import { ideaToPostSeed } from "@/lib/idea";

export type ConvertResult = { postId: string; created: boolean };

export async function convertIdeaToPost(
  ideas: Pick<IdeaRepo, "get" | "markConverted">,
  posts: Pick<PostRepo, "get" | "create">,
  ideaId: string,
): Promise<ConvertResult> {
  const idea = await ideas.get(ideaId);
  if (!idea) throw new IdeaNotFoundError(ideaId);

  if (idea.convertedToPostId && (await posts.get(idea.convertedToPostId))) {
    return { postId: idea.convertedToPostId, created: false };
  }

  const seed = ideaToPostSeed(idea);
  // নির্ধারিত id: আগের চেষ্টায় পোস্ট তৈরি হয়ে থাকলে create সেটাই ফেরত দেয় (postRepo.create idempotent)
  const post = await posts.create({
    id: ideaId,
    title: seed.title,
    body: seed.body,
    excerpt: seed.excerpt,
    wordCount: seed.wordCount,
  });
  await ideas.markConverted(ideaId, post.id);
  return { postId: post.id, created: true };
}
