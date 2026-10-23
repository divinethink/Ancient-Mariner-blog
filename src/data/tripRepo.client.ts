// পথ ক (owner-CSR): `trips` — owner write; শুধু dashboard থেকে dynamic import।
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import {
  TRIP_SCHEMA_VERSION,
  TripCostSchema,
  TripNoteSchema,
  TripNotFoundError,
  TripPlaceSchema,
  parseTrip,
  type CreateTripInput,
  type TripPatch,
  type TripRepo,
  type TripWithId,
} from "@/data/tripRepo";
import { isDayKey } from "@/lib/books";
import { TripStatus } from "@/lib/enums";
import { newId } from "@/lib/id";
import { TRIP_LIST_MAX } from "@/lib/trips";

export function createTripRepoClient(db: Firestore, ownerUid: string): TripRepo {
  const ref = (id: string) => doc(db, "trips", id);

  async function get(id: string): Promise<TripWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseTrip(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<TripWithId> => {
    const v = await get(id);
    if (!v) throw new TripNotFoundError(id);
    return v;
  };
  const day = (s: string | undefined): string | undefined => (s !== undefined && isDayKey(s) ? s : undefined);

  async function list(): Promise<TripWithId[]> {
    const q = query(collection(db, "trips"), orderBy("updatedAt", "desc"), limit(TRIP_LIST_MAX));
    const out: TripWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseTrip(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateTripInput): Promise<TripWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const d = day(input.day);
    await setDoc(ref(id), {
      place: TripPlaceSchema.parse(input.place),
      status: TripStatus.parse(input.status),
      note: "",
      ...(d ? { day: d } : {}),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: TRIP_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function update(id: string, patch: TripPatch): Promise<TripWithId> {
    await must(id);
    const d = day(patch.day);
    await updateDoc(ref(id), {
      ...(patch.place !== undefined ? { place: TripPlaceSchema.parse(patch.place) } : {}),
      ...(patch.status !== undefined ? { status: TripStatus.parse(patch.status) } : {}),
      ...(patch.note !== undefined ? { note: TripNoteSchema.parse(patch.note) } : {}),
      ...(patch.costTaka === null ? { costTaka: deleteField() } : patch.costTaka !== undefined ? { costTaka: TripCostSchema.parse(patch.costTaka) } : {}),
      ...(d ? { day: d } : {}),
      updatedAt: serverTimestamp(),
    });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, create, update, delete: del };
}
