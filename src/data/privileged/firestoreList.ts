// Privileged allowlist ৬ (Arch §২): backup job-এর collection পড়া — Firestore REST `documents.list`, pageToken-ভিত্তিক (শুধু GET, কোনো write নয়)।
// id-cursor ব্যবহার নেই: `slugs`-এর doc-id বাংলা Unicode, resource-name encoding নিয়ে ঝুঁকি এড়াতে। শুধু scripts/backup.ts থেকে import।
import { decodeDocument, type RestDocument } from "../firestoreRest";
import { withRetry } from "../retry";

export type ListedDoc = { id: string; data: Record<string, unknown> };

/** REST নাম কখনো percent-encoded এলে ফিরিয়ে আনে (raw হলে অপরিবর্তিত); বিকৃত হলে যেমন আছে */
export function safeDecodeId(id: string): string {
  if (!id.includes("%")) return id;
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export function createCollectionReader(opts: {
  projectId: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}) {
  const { projectId, getToken, fetchImpl = fetch } = opts;
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  return async function readPage(
    collection: string,
    cursor: string | undefined,
    size: number,
  ): Promise<{ docs: ListedDoc[]; next?: string }> {
    if (!/^[A-Za-z0-9_]{1,60}$/.test(collection)) throw new Error("অবৈধ collection-নাম");
    const url = `${base}/${collection}?pageSize=${size}${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ""}`;
    const j = await withRetry(async (signal) => {
      const res = await fetchImpl(url, {
        headers: { authorization: `Bearer ${await getToken()}` },
        signal,
      });
      if (!res.ok) throw new Error(`Firestore list ${res.status}`);
      return (await res.json()) as { documents?: RestDocument[]; nextPageToken?: string };
    });
    const docs = (j.documents ?? []).map((d) => {
      const { id, data } = decodeDocument(d);
      return { id: safeDecodeId(id), data };
    });
    return { docs, next: j.nextPageToken || undefined };
  };
}
