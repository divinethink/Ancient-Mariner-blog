// কপি-Markdown-এর জন্য: doc-এর mediaId → পাবলিক Cloudinary URL (শুধু read; private/মোছা/ব্যর্থ হলে বাদ ⇒ serializer `[ছবি: …]` দেয়)।
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";

const TIMEOUT_MS = 6000;
const WIDTH = 1600;

export async function resolveMediaUrls(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const work = (async () => {
    const repo = await getMediaRepo();
    const res = await Promise.allSettled(ids.map((id) => repo.get(id)));
    res.forEach((r, i) => {
      if (r.status !== "fulfilled" || !r.value) return;
      const cloud = cloudFromUrl(r.value.cloudinaryUrl);
      const url = cloud ? cldUrl(cloud, r.value.cloudinaryPublicId, { w: WIDTH }) : null;
      if (url) out.set(ids[i], url);
    });
  })();
  // সময় ফুরালে এখন পর্যন্ত যা মিলেছে তা-ই; বাকিগুলো স্থানধারক
  await Promise.race([work.catch(() => undefined), new Promise<void>((r) => setTimeout(r, TIMEOUT_MS))]);
  return out;
}
