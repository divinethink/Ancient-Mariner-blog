// ব্রাউজারে owner-এর NoteRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { NoteRepo } from "@/data/noteRepo";

export async function getNoteRepo(): Promise<NoteRepo> {
  const [{ db, uid }, { createNoteRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/noteRepo.client"),
  ]);
  return createNoteRepoClient(db, uid);
}
