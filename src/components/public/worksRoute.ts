// `/works` পেজগুলোর সাধারণ সহায়ক (P14c-১): slug decode, SITE_URL-নিরাপদ, প্রজেক্ট/অধ্যায় খোঁজা। blog/[slug]-এর ধাঁচ।
import { getSiteUrl } from "@/config/env";
import { getPublicWorks } from "@/data/worksSnapshot";

export const decodeSlug = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function safeSiteUrl(): string | undefined {
  try {
    return getSiteUrl();
  } catch {
    return undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
}

export async function findWork(rawProject: string) {
  const slug = decodeSlug(rawProject);
  return (await getPublicWorks()).find((w) => w.project.slug === slug);
}

export async function findChapter(rawProject: string, rawChapter: string) {
  const work = await findWork(rawProject);
  const slug = decodeSlug(rawChapter);
  const chapter = work?.chapters.find((c) => c.slug === slug);
  return work && chapter ? { work, chapter } : undefined;
}
