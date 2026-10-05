// build-সময়ের পাবলিক asset-যাচাই (শুধু build; Worker runtime-এ নয়)।
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OG_DEFAULT_PATH } from "../lib/seo";

/** `public/og-default.png` আছে কিনা — না থাকলে og:image tag বাদ, build ভাঙে না */
export function hasDefaultOgImage(): boolean {
  return existsSync(join(process.cwd(), "public", OG_DEFAULT_PATH));
}
