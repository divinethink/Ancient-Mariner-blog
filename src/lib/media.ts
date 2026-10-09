// মিডিয়া-আপলোডের pure নিয়ম (P6-২): ফাইল-শ্রেণি, সীমা, resize-গণিত। DOM/SDK-মুক্ত।
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // Cloudinary Free: ছবি/raw ≤১০MB
export const IMAGE_MAX_SIDE = 2000; // আপলোডের আগে client-side resize (owner-অনুমোদিত)
export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
// svg ইচ্ছাকৃতভাবে নেই (script বহন করতে পারে); raw ফাইল শুধু এই extension
export const FILE_EXT = ["pdf", "txt", "doc", "docx", "zip"] as const;

export const extFromName = (name: string): string => {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
};

export type FileKind = "image" | "file";

/** অনুমোদিত না হলে null */
export function classifyFile(name: string, mime: string): FileKind | null {
  if ((IMAGE_MIME as readonly string[]).includes(mime.toLowerCase())) return "image";
  if ((FILE_EXT as readonly string[]).includes(extFromName(name))) return "file";
  return null;
}

/** দীর্ঘতম দিক `max`-এর বেশি হলে অনুপাত রেখে ছোট; নইলে অপরিবর্তিত */
export function fitWithin(w: number, h: number, max: number = IMAGE_MAX_SIDE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const longest = Math.max(w, h);
  if (longest <= max) return { w: Math.round(w), h: Math.round(h) };
  const k = max / longest;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
