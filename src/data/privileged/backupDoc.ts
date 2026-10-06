// Privileged allowlist ৬ (Arch §২): backup job শুধু `backups/{id}` নতুন doc বানায় — আর কিছু লেখে না, মোছে না।
// কেবল scripts/backup.ts (Node, GitHub Actions; P5b-২) থেকে import। doc-id নির্ধারিত (ফোল্ডার-নাম) ⇒ retry/দ্বিতীয় রানে duplicate নয়।
import { BackupMetaSchema, type BackupMeta } from "@/data/backupStatusRepo";
import { withRetry } from "@/data/retry";

export type BackupDocResult = "created" | "exists";

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function encodeBackupMeta(m: BackupMeta): Record<string, unknown> {
  const ts = (d: Date) => ({ timestampValue: d.toISOString() });
  const str = (s: string) => ({ stringValue: s });
  const int = (n: number) => ({ integerValue: String(n) });
  return {
    type: str(m.type),
    format: str(m.format),
    status: str(m.status),
    driveFolderId: str(m.driveFolderId),
    counts: { mapValue: { fields: Object.fromEntries(Object.entries(m.counts as Record<string, number>).map(([k, v]) => [k, int(v)])) } },
    completedAt: ts(m.completedAt),
    ownerUid: str(m.ownerUid),
    createdAt: ts(m.createdAt),
    updatedAt: ts(m.updatedAt),
    schemaVersion: int(m.schemaVersion),
  };
}

export function createBackupDocWriter(opts: {
  projectId: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}) {
  const { projectId, getToken, fetchImpl = fetch } = opts;
  const root = `projects/${projectId}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${encodeURI(root)}:commit`;

  return {
    /** শুধু সম্পূর্ণ-যাচাই-হওয়া backup-এর পরে ডাকা হবে। বিদ্যমান id = "exists" (overwrite নয়) */
    async create(id: string, input: unknown): Promise<BackupDocResult> {
      if (!ID_RE.test(id)) throw new Error("অবৈধ backup id");
      const meta = BackupMetaSchema.parse(input);
      const body = {
        writes: [{ update: { name: `${root}/backups/${id}`, fields: encodeBackupMeta(meta) }, currentDocument: { exists: false } }],
      };
      return withRetry(async (signal): Promise<BackupDocResult> => {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { authorization: `Bearer ${await getToken()}`, "content-type": "application/json" },
          body: JSON.stringify(body),
          signal,
        });
        if (res.ok) return "created";
        if (res.status === 409 || res.status === 400) {
          const j = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
          if (j?.error?.status === "ALREADY_EXISTS" || j?.error?.status === "FAILED_PRECONDITION") return "exists";
        }
        throw new Error(`Firestore commit ${res.status}`);
      });
    },
  };
}
