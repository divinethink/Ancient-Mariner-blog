// build-এর পাবলিক পড়ার তাক: `scripts/fetch-public-data.ts` লেখে, `/shelf` ও sidebar শুধু এই ফাইল পড়ে (worksSnapshot-এর মতো আলাদা ফাইল)।
// ফাইল না থাকলে/বিকৃত হলে খালি ⇒ তাক ফাঁকা, সাইট অক্ষত। শুধু `visibility='public'` রাখা হয় (পড়ার সময়ও আবার ছাঁকা)।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseBook, type BookWithId } from "./bookRepo";
import { dayKey } from "../lib/datetime";

export const SHELF_FILE = join(".build-data", "shelf.json");

export async function writeShelf(books: readonly BookWithId[], path = SHELF_FILE): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(books.filter((b) => b.visibility === "public")), "utf8");
}

export async function readShelf(path = SHELF_FILE): Promise<BookWithId[]> {
  let rows: unknown;
  try {
    rows = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return [];
  }
  return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).flatMap((r) => {
    try {
      const b = parseBook(String(r.id), r);
      return b.visibility === "public" ? [b] : [];
    } catch {
      return [];
    }
  });
}

/** build-মুহূর্তের বছর (সাইট-timezone-এ) — 'এ বছর N বই'-এর জন্য; component-এর বাইরে, যাতে render-এ impure call না থাকে */
export const buildYear = (timeZone: string): number => Number(dayKey(Date.now(), timeZone).slice(0, 4));

let memo: Promise<BookWithId[]> | undefined;
/** Next build-এর পাবলিক পেজের জন্য (প্রতি worker-এ ফাইল একবার পড়ে); ফাইল না থাকলে খালি */
export function getPublicShelf(): Promise<BookWithId[]> {
  memo ??= readShelf();
  return memo;
}
