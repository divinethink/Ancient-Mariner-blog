// build-এর 'পঠিত' ফল (P11a-২): `scripts/fetch-public-data.ts` লেখে, পাবলিক পেজ শুধু এই ফাইল পড়ে (snapshot-এর মতো)।
// ফাইল না থাকলে/বিকৃত হলে খালি — 'পঠিত' widget লুকানো, সাইট অক্ষত।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { PopularRow } from "../lib/popular";

export const POPULAR_PATH = join(".build-data", "popular.json");

const Schema = z.object({ items: z.array(z.object({ postId: z.string(), n: z.number().int().positive() })).max(50) });

export async function writePopular(items: readonly PopularRow[], path = POPULAR_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ items }), "utf8");
}

export async function readPopular(path = POPULAR_PATH): Promise<PopularRow[]> {
  try {
    const x = Schema.safeParse(JSON.parse(await readFile(path, "utf8")));
    return x.success ? x.data.items : [];
  } catch {
    return [];
  }
}

let memo: Promise<PopularRow[]> | undefined;
/** Next build-এর পাবলিক পেজের জন্য (প্রতি worker-এ একবার পড়ে) */
export function getPopular(): Promise<PopularRow[]> {
  memo ??= readPopular();
  return memo;
}
