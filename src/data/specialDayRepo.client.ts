// পথ ক (owner-CSR): `specialDays` — owner write; শুধু dashboard থেকে dynamic import।
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import {
  SPECIAL_DAY_SCHEMA_VERSION,
  SpecialKindLabelSchema,
  SpecialNameSchema,
  SpecialNoteSchema,
  SpecialYearSchema,
  parseSpecialDay,
  type CreateSpecialDayInput,
  type SpecialDayRepo,
  type SpecialDayWithId,
} from "@/data/specialDayRepo";
import { SpecialDayKind } from "@/lib/enums";
import { newId } from "@/lib/id";
import { SPECIAL_LIST_MAX, validMonthDay } from "@/lib/specialDays";

export function createSpecialDayRepoClient(db: Firestore, ownerUid: string): SpecialDayRepo {
  const ref = (id: string) => doc(db, "specialDays", id);

  async function get(id: string): Promise<SpecialDayWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseSpecialDay(id, snap.data()) : null;
  }

  async function list(): Promise<SpecialDayWithId[]> {
    const q = query(collection(db, "specialDays"), orderBy("createdAt", "asc"), limit(SPECIAL_LIST_MAX));
    const out: SpecialDayWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseSpecialDay(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateSpecialDayInput): Promise<SpecialDayWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    if (!validMonthDay(input.month, input.day)) throw new Error("অবৈধ মাস/দিন");
    await setDoc(ref(id), {
      name: SpecialNameSchema.parse(input.name),
      kind: SpecialDayKind.parse(input.kind),
      month: input.month,
      day: input.day,
      ...(input.year !== undefined ? { year: SpecialYearSchema.parse(input.year) } : {}),
      ...(input.kind === "other" && input.kindLabel?.trim() ? { kindLabel: SpecialKindLabelSchema.parse(input.kindLabel) } : {}),
      note: input.note === undefined ? "" : SpecialNoteSchema.parse(input.note),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: SPECIAL_DAY_SCHEMA_VERSION,
    });
    const v = await get(id);
    if (!v) throw new Error("সংরক্ষিত বিশেষ দিন পাওয়া যায়নি");
    return v;
  }

  async function setNote(id: string, note: string): Promise<SpecialDayWithId> {
    if (!(await get(id))) throw new Error("বিশেষ দিন পাওয়া যায়নি");
    await updateDoc(ref(id), { note: SpecialNoteSchema.parse(note), updatedAt: serverTimestamp() });
    const v = await get(id);
    if (!v) throw new Error("সংরক্ষিত বিশেষ দিন পাওয়া যায়নি");
    return v;
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, create, setNote, delete: del };
}
