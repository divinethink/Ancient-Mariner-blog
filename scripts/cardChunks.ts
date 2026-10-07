// [আরও দেখান] card-JSON chunk → assets/data/cards/<key>-<n>.json (Arch §২); snapshot থেকে — আলাদা Firestore read নেই।
// build-seo.ts থেকে ডাকা (package.json অপরিবর্তিত রাখতে)।
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { Snapshot } from "../src/data/publicSnapshot";
import { cardChunkPath, splitCards } from "../src/lib/cards";
import { buildScopes, type Scope } from "../src/lib/publicLists";

export async function writeCardChunks(snap: Snapshot, assetsDir: string): Promise<Scope[]> {
  const scopes = buildScopes({ posts: snap.posts, terms: snap.terms, timeZone: snap.settings.timezone });
  const dir = `${assetsDir}/data/cards`;
  await rm(dir, { recursive: true, force: true }); // আগের build-এর বাসি chunk নয়
  await mkdir(dir, { recursive: true });
  let files = 0;
  for (const s of scopes) {
    const { chunks } = splitCards(s.cards, snap.settings.postsPerPage, s.key);
    for (let i = 0; i < chunks.length; i++) {
      await writeFile(`${assetsDir}${cardChunkPath(s.key, i + 2)}`, JSON.stringify(chunks[i]), "utf8");
      files++;
    }
  }
  console.log(`✅ card chunk: ${files}টি ফাইল (${scopes.length}টি তালিকা)`);
  return scopes;
}
